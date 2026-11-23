"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./Category.module.css";

export interface TypeTile {
  href: string; // EN: for the chosen type, the link without it (a second click clears it). PT: no tipo escolhido, a ligação sem ele.
  label: string;
  images: string[];
  current: boolean;
}

/**
 * EN: Type bar of design V3: circular frames, centred, names in capitals; the photo of a type is a piece of that type
 *     (until the team frames one in Gestão → Tipos de peça). No "Todos" (owner 2026-11-23): clicking the chosen type
 *     again clears it, and the toolbar chip clears it too. When the circles do not fit, small arrows on the sides
 *     show there are more and slide the bar.
 * PT: Barra de tipos do V3: molduras circulares, centradas, nomes em maiúsculas. Sem "Todos" (dona 23-11-2026): voltar
 *     a clicar no tipo escolhido tira o filtro, e a etiqueta na barra de filtros também. Quando os círculos não cabem,
 *     setas pequenas dos lados mostram que há mais e deslizam a barra.
 */
export function TypeBar({ tiles, label, min = 2 }: { tiles: TypeTile[]; label: string; min?: number }) {
  const { dict } = useI18n();
  const bar = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [tiles.length]);

  if (tiles.length < min) return null;
  const slide = (dir: 1 | -1) => bar.current?.scrollBy({ left: dir * bar.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <div className={styles.typeWrap}>
      <nav ref={bar} aria-label={label} className={`${styles.typeBar} ${tiles.length > 8 ? styles.typeBarDense : ""}`}>
        {tiles.map((tile) => (
          <Link key={`${tile.href} ${tile.label}`} href={tile.href} className={styles.typeItem} aria-current={tile.current ? "page" : undefined} scroll={false}>
            <span className={styles.typeImage}>{tile.images[0] && <Image src={tile.images[0]} alt="" width={96} height={96} />}</span>
            <span className={styles.typeLabel}>{tile.label}</span>
          </Link>
        ))}
      </nav>
      {edges.start && (
        <button type="button" className={`${styles.typeArrow} ${styles.typeArrowStart}`} aria-label={dict.home.previous} onClick={() => slide(-1)}>
          <Icon name="chevronLeft" size={16} />
        </button>
      )}
      {edges.end && (
        <button type="button" className={`${styles.typeArrow} ${styles.typeArrowEnd}`} aria-label={dict.home.next} onClick={() => slide(1)}>
          <Icon name="chevronRight" size={16} />
        </button>
      )}
    </div>
  );
}
