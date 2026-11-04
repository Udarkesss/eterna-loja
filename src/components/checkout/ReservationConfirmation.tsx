"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api-client";
import { formatMZN } from "@/lib/format";
import type { ReservationDTO } from "@/types";
import styles from "./Confirmation.module.css";

/**
 * EN: "Confirmação · reserva" of design V3: "Peça reservada.", number and date, what was paid and what is left, where and
 *     until when to collect, the WhatsApp reminder, the non-refundable deposit; "Ver as minhas reservas" and "Pedir mais
 *     tempo". While the deposit is still being confirmed (transfer), the page checks again every few seconds.
 * PT: "Confirmação · reserva" do V3. Enquanto o sinal ainda está a ser confirmado (transferência), a página volta a
 *     verificar de segundos a segundos.
 */
export function ReservationConfirmation({ initial, created }: { initial: ReservationDTO; created: string }) {
  const { dict, locale, href } = useI18n();
  const r = dict.reservation;
  const [res, setRes] = useState(initial);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (res.status !== "pending") return;
    const timer = setInterval(() => {
      api
        .getReservation(res.token)
        .then(setRes)
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(timer);
  }, [res.status, res.token]);

  const until = res.expiresAt ? new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Maputo" }).format(new Date(res.expiresAt)) : "";
  const untilShort = until.replace(/( de)? \d{4}$/, "");
  const store = `Loja ${Number(res.storeCode ?? "2")}`;
  const money = (v: number) => formatMZN(v, locale);
  const pct = res.total ? Math.round((res.deposit / res.total) * 100) : 50;

  const view: { tone?: "warn" | "bad"; tag: string; title: string; sub: string; rows: [IconName, string][] } =
    res.status === "pending"
      ? { tone: "warn", tag: r.pendingTag, title: r.pendingTitle, sub: t(r.pendingSub, { code: res.code }), rows: [["clock", t(r.pendingBody, { deposit: money(res.deposit) })]] }
      : res.status === "active"
        ? {
            tag: r.confirmed,
            title: r.title,
            sub: t(r.sub, { code: res.code, date: untilShort }),
            rows: [
              ["card", t(r.paid, { deposit: money(res.deposit), pct, rest: money(res.rest) })],
              ["store", t(r.collect, { store, date: until })],
              ["bell", r.remind],
              ["alert", r.deadline],
            ],
          }
        : res.status === "completed"
          ? { tag: r.completedTag, title: r.completedTitle, sub: t(r.completedSub, { code: res.code }), rows: [["sparkle", r.completedBody]] }
          : { tone: "bad", tag: res.status === "expired" ? r.expiredTag : r.cancelledTag, title: res.status === "expired" ? r.expiredTitle : r.cancelledTitle, sub: t(r.endedSub, { code: res.code }), rows: [["alert", res.status === "expired" ? r.expiredBody : r.cancelledBody]] };

  async function askMore() {
    setAsking(true);
    try {
      setRes(await api.askMoreTime(res.token));
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className={`page-x`}>
      <div className={styles.wrap}>
        <span className={styles.state} data-tone={view.tone}>
          <Icon name={view.tone === "bad" ? "alert" : view.tone === "warn" ? "clock" : "check"} size={16} />
          {view.tag}
        </span>
        <h1 className={styles.title}>
          {view.title}
          <br />
          <em>{view.sub}</em>
        </h1>
        <span className={styles.meta}>
          <RichText text={t(r.number, { number: res.number, date: created })} />
        </span>
        <ul className={styles.list}>
          {view.rows.map(([icon, text]) => (
            <li key={text}>
              <span className={styles.circle}>
                <Icon name={icon} size={18} />
              </span>
              <span>
                <RichText text={text} />
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link href={`${href("/account")}#reservas`} className={styles.btnPrimary}>
            {r.seeMine}
          </Link>
          {res.status === "active" && (res.canAskMore || res.moreTimeAsked) && (
            <button type="button" className={styles.btn} onClick={askMore} disabled={asking || res.moreTimeAsked}>
              <Icon name="whatsapp" size={16} />
              {res.moreTimeAsked ? r.moreTimeAsked : r.moreTime}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
