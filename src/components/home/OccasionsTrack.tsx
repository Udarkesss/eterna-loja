"use client";

import { useRef, useState, type ReactNode } from "react";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./Home.module.css";

/**
 * EN: On phones the occasions mosaic becomes a swipeable row with a "1 / 7" counter (Telemóvel · Início).
 *     On larger screens it is the design's 4-column mosaic; the counter is hidden by CSS.
 * PT: No telemóvel o mosaico de ocasiões vira uma fila deslizável com contador "1 / 7".
 */
export function OccasionsTrack({ count, children }: { count: number; children: ReactNode }) {
  const { dict } = useI18n();
  const ref = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(1);

  function onScroll() {
    const el = ref.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    setCurrent(Math.min(count, Math.round(el.scrollLeft / (first.offsetWidth + 12)) + 1));
  }

  return (
    <>
      <span className={styles.counter} aria-hidden="true">
        {t(dict.home.swipeCount, { current, total: count })}
      </span>
      <ul ref={ref} className={styles.mosaic} onScroll={onScroll}>
        {children}
      </ul>
    </>
  );
}
