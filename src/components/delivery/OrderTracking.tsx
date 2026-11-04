"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { whatsappLink } from "@/data/site";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { distanceKm } from "@/lib/delivery";
import { toMaputo } from "@/lib/time";
import type { TrackingDTO } from "@/server/delivery";
import type { MapMarker } from "./LiveMap";
import styles from "./Tracking.module.css";

const LiveMap = dynamic(() => import("./LiveMap").then((m) => m.LiveMap), { ssr: false });
const POLL_MS = 15_000;

/**
 * EN: Live parts of "Acompanhar a entrega" (design V3-Acompanhar): the map with the store, the driver and the address
 *     ("Ao vivo · há 20 s"), and the driver card (expected arrival, distance, Ligar, WhatsApp). Refreshes every 15 s
 *     until the delivery is finished; a new state reloads the page (timeline).
 * PT: Partes ao vivo de "Acompanhar a entrega" (V3): o mapa com a loja, o entregador e a morada, e o cartão do
 *     entregador (chegada prevista, distância, Ligar, WhatsApp). Actualiza a cada 15 s até a entrega terminar.
 */
export function TrackingMap({ orderId, initial }: { orderId: string; initial: TrackingDTO }) {
  const data = useTracking(orderId, initial);
  const { dict } = useI18n();
  const tr = dict.order.tracking;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const markers: MapMarker[] = [
    { ...data.origin, kind: "store", label: tr.storeLabel },
    ...(data.position ? [{ ...data.position, kind: "driver" as const, label: tr.driverLabel }] : []),
    ...(data.destination ? [{ ...data.destination, kind: "destination" as const, label: tr.you }] : []),
  ];
  const age = data.position ? Math.max(0, Math.round((now - new Date(data.position.at).getTime()) / 1000)) : null;
  return (
    <div className={styles.map}>
      <LiveMap markers={markers} ariaLabel={tr.mapLabel} height={520} />
      {age !== null && (
        <span className={styles.live}>
          <Icon name="dot" size={12} />
          {age < 120 ? t(tr.live, { seconds: age }) : t(tr.liveMinutes, { minutes: Math.round(age / 60) })}
        </span>
      )}
    </div>
  );
}

export function DriverCard({ orderId, initial }: { orderId: string; initial: TrackingDTO }) {
  const data = useTracking(orderId, initial);
  const { dict, locale } = useI18n();
  const tr = dict.order.tracking;
  if (!data.driver) return null;
  const km = data.position && data.destination ? distanceKm(data.position, data.destination) : null;
  return (
    <section className={styles.card} aria-label={tr.yourDriver}>
      <span className="eyebrow">{tr.yourDriver}</span>
      <div className={styles.driver}>
        <span className={styles.avatar}>{data.driver.initials}</span>
        <span className={styles.driverText}>
          <b>{data.driver.name}</b>
          {data.driver.vehicle && <span className={styles.muted}>{data.driver.vehicle}</span>}
        </span>
      </div>
      <div className={styles.facts}>
        <div>
          <span className={styles.xs}>{tr.eta}</span>
          <span className={styles.fact}>{data.status === "delivered" || data.status === "confirmed" ? tr.arrived : data.etaAt ? toMaputo(data.etaAt).time : "—"}</span>
        </div>
        <div>
          <span className={styles.xs}>{tr.distance}</span>
          <span className={styles.fact}>{km != null ? `${km.toLocaleString(locale === "pt" ? "pt-PT" : "en-GB", { maximumFractionDigits: 1 })} km` : "—"}</span>
        </div>
      </div>
      {data.driver.phone && (
        <div className={styles.buttons}>
          <a href={`tel:+258${data.driver.phone}`} className={styles.btn}>
            <Icon name="phone" size={16} />
            {tr.call}
          </a>
          <a href={whatsappLink(undefined, `258${data.driver.phone}`)} target="_blank" rel="noopener noreferrer" className={styles.btn}>
            <Icon name="whatsapp" size={16} />
            WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}

/** EN: Shared polling (one request per component, every 15 s). PT: Consulta partilhada, a cada 15 s. */
function useTracking(orderId: string, initial: TrackingDTO) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const finished = data.status === "confirmed" || data.status === "cancelled";
  useEffect(() => {
    if (finished) return;
    const id = setInterval(async () => {
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
  return data;
}
