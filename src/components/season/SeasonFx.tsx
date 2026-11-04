"use client";

import { useMemo } from "react";
import styles from "./Season.module.css";

/**
 * EN: The visual effect of a time of the year over the page (gold sparkles, snow or hearts). Decorative only: hidden
 *     from screen readers and stopped for people who ask for reduced motion.
 * PT: O efeito visual da época por cima da página (brilhos dourados, neve ou corações). Só decorativo: escondido dos
 *     leitores de ecrã e parado para quem pede movimento reduzido.
 */
export function SeasonFx({ effect }: { effect: "sparkles" | "snow" | "hearts" }) {
  // EN: Fixed pseudo-random positions (same on server and client). PT: Posições fixas (iguais no servidor e no browser).
  const dots = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    return Array.from({ length: 60 }, () => ({ left: rnd() * 100, duration: 9 + rnd() * 9, delay: rnd() * 18, opacity: 0.45 + rnd() * 0.5 }));
  }, []);
  return (
    <div className={styles.fx} data-effect={effect} aria-hidden="true">
      {dots.map((d, i) => (
        <i key={i} style={{ left: `${d.left.toFixed(1)}%`, animationDuration: `${d.duration.toFixed(1)}s`, animationDelay: `-${d.delay.toFixed(1)}s`, opacity: d.opacity }}>
          {effect === "hearts" ? "♥" : null}
        </i>
      ))}
    </div>
  );
}
