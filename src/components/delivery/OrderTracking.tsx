"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { formatMsisdn } from "@/lib/payments/msisdn";
import { toMaputo } from "@/lib/time";
import type { TrackingDTO } from "@/server/delivery";
import type { MapMarker } from "./LiveMap";
import styles from "./Tracking.module.css";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false });
const POLL_MS = 15_000;

/**
 * EN: "Telemóvel · Acompanhar entrega": live map (only while on the way), the driver card, expected arrival and
 *     "Confirmo que recebi". Refreshes every 15 s while the delivery is not finished.
 * PT: Mapa ao vivo (só a caminho), cartão do entregador, hora prevista e "Confirmo que recebi". Actualiza a cada 15 s.
 */
export function OrderTracking({ orderId, number, initial }: { orderId: string; number: string; initial: TrackingDTO }) {
  const { dict } = useI18n();
  const tr = dict.order.tracking;
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const finished = data.status === "confirmed" || data.status === "cancelled";

  useEffect(() => {
    if (finished) return;
    const id = setInterval(async () => {
      setNow(Date.now());
      try {
        const res = await fetch(`/api/v1/orders/${orderId}/tracking`, { cache: "no-store" });
        const body = (await res.json()) as { data?: TrackingDTO };
        if (body.data) {
          if (body.data.status !== data.status) router.refresh(); // EN: update the timeline. PT: actualizar a cronologia.
          setData(body.data);
        }
      } catch {
        // EN: try again on the next tick. PT: tenta de novo.
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [finished, orderId, data.status, router]);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/confirm-receipt`, { method: "POST" });
      const body = (await res.json()) as { data?: TrackingDTO };
      if (body.data) setData(body.data);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const markers: MapMarker[] = [
    { ...data.origin, kind: "store", label: `${tr.store} 02` },
    ...(data.position ? [{ ...data.position, kind: "driver" as const }] : []),
    ...(data.destination ? [{ ...data.destination, kind: "destination" as const, label: tr.you }] : []),
  ];
  const age = data.position ? Math.max(0, Math.round((now - new Date(data.position.at).getTime()) / 1000)) : null;
  const showMap = data.status === "in_transit" && !!data.destination;

  return (
    <div className={styles.wrap}>
      {(data.status === "in_transit" || data.status === "delivered" || data.status === "confirmed") && (
        <div className={styles.head}>
          <h2 className={styles.title}>
            {data.status === "in_transit" ? tr.onTheWay : data.status === "delivered" ? tr.deliveredTitle : tr.confirmedTitle}
          </h2>
          <span className={styles.sub}>
            {data.status === "in_transit" && data.startedAt
              ? t(tr.leftAt, { time: toMaputo(data.startedAt).time })
              : data.status === "delivered"
                ? tr.deliveredSub
                : data.confirmedAt
                  ? t(tr.confirmedSub, { time: toMaputo(data.confirmedAt).time })
                  : ""}
          </span>
        </div>
      )}

      {showMap && (
        <section className={styles.mapBox}>
          <div style={{ position: "relative" }}>
            <LiveMap markers={markers} ariaLabel={tr.mapLabel} height={240} />
            {age !== null && (
              <span className={styles.live}>{age < 120 ? t(tr.live, { seconds: age }) : t(tr.liveMinutes, { minutes: Math.round(age / 60) })}</span>
            )}
          </div>
          <span className={styles.note}>{tr.mapNote}</span>
        </section>
      )}

      {data.driver && data.status !== "confirmed" && (
        <section className={styles.card} aria-label={tr.yourDriver}>
          <div className={styles.driver}>
            <span className={styles.avatar}>{data.driver.initials}</span>
            <span className={styles.driverText}>
              <span className={styles.small}>{tr.yourDriver}</span>
              <span className={styles.name}>{data.driver.name}</span>
              {data.driver.phone && <span className={styles.note}>+258 {formatMsisdn(data.driver.phone)}</span>}
            </span>
          </div>
          <dl className={styles.facts}>
            {data.driver.vehicle && (
              <div>
                <dt>{tr.vehicle}</dt>
                <dd>
                  <Icon name="truck" size={18} /> {data.driver.vehicle}
                </dd>
              </div>
            )}
            <div>
              <dt>{tr.eta}</dt>
              <dd className={styles.eta}>{data.status === "delivered" ? tr.arrived : data.etaAt ? toMaputo(data.etaAt).time : "—"}</dd>
            </div>
          </dl>
          {data.driver.phone && (
            <div className={styles.buttons}>
              <a href={`tel:+258${data.driver.phone}`} className={styles.btnOutline}>
                <Icon name="phone" size={18} />
                {tr.call}
              </a>
              <a href={whatsappLink(undefined, `258${data.driver.phone}`)} className={styles.btnOutline}>
                <Icon name="whatsapp" size={18} />
                WhatsApp
              </a>
            </div>
          )}
        </section>
      )}

      {data.status === "delivered" && (
        <section className={styles.confirm}>
          <h3 className={styles.confirmTitle}>{tr.receivedQuestion}</h3>
          <p className={styles.note} style={{ fontSize: 14, lineHeight: "22px" }}>
            {tr.receivedBody}
          </p>
          <button className={styles.btn} disabled={busy} onClick={confirm}>
            <Icon name="check" size={18} />
            {tr.confirmReceived}
          </button>
          <a href={whatsappLink(t(tr.photoMessage, { number }), data.storeWhatsapp)} target="_blank" rel="noopener noreferrer" className={styles.btnOutline}>
            <Icon name="camera" size={18} />
            {tr.sendPhoto}
          </a>
        </section>
      )}

      {data.status === "confirmed" && (
        <div role="status" className={styles.done}>
          <Icon name="check" size={18} />
          <span>{tr.confirmedNote}</span>
        </div>
      )}
    </div>
  );
}
