"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/**
 * EN: Campaign countdown of design V3 (days · hours · min). It refreshes the page when the campaign ends, so the prices
 *     go back to normal at once.
 * PT: Contagem decrescente da campanha (dias · horas · min). Recarrega a página quando a campanha termina, para os
 *     preços voltarem ao normal logo.
 */
function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const two = (n: number) => String(n).padStart(2, "0");

export function useCountdown(endsAt: string) {
  const [left, setLeft] = useState(() => Date.parse(endsAt) - Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const next = Date.parse(endsAt) - Date.now();
      setLeft(next);
      if (next <= 0) {
        clearInterval(id);
        window.location.reload();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return parts(left);
}

export function Countdown({ endsAt, className, boxClassName, valueClassName, labelClassName }: { endsAt: string; className?: string; boxClassName?: string; valueClassName?: string; labelClassName?: string }) {
  const { dict } = useI18n();
  const c = useCountdown(endsAt);
  const items: [number, string][] = [
    [c.d, dict.campaign.days],
    [c.h, dict.campaign.hours],
    [c.m, dict.campaign.minutes],
  ];
  return (
    <div className={className} role="timer" aria-live="off">
      {items.map(([n, label]) => (
        <span key={label} className={boxClassName}>
          <b className={valueClassName}>{two(n)}</b>
          <span className={labelClassName}>{label}</span>
        </span>
      ))}
    </div>
  );
}

/** EN: "faltam 03:12" for the flash bar. PT: "faltam 03:12" para a barra relâmpago. */
export function TimeLeft({ endsAt }: { endsAt: string }) {
  const c = useCountdown(endsAt);
  return (
    <span className="num">
      {two(c.d * 24 + c.h)}:{two(c.m)}
    </span>
  );
}
