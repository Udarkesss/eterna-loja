"use client";

import { useEffect } from "react";

/**
 * EN: Parallax from the design: every element with data-parallax moves slower than the page while scrolling.
 *     Off for "reduce motion"; weaker on low-end phones or data-saver (design: "Reduzir em telemóveis mais fracos").
 * PT: Parallax do design: elementos com data-parallax movem-se mais devagar do que a página.
 *     Desligado com "reduzir movimento"; mais fraco em telemóveis fracos ou poupança de dados.
 */
export function Parallax({ enabled = true, intensity = 0.25 }: { enabled?: boolean; intensity?: number }) {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const weak = (navigator.hardwareConcurrency || 8) <= 4 || !!connection?.saveData;
    const k = intensity * (weak ? 0.4 : 1);
    let ticking = false;

    const update = () => {
      ticking = false;
      const on = enabled && !reduce;
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const parent = el.parentElement;
        if (!parent) return;
        const box = parent.getBoundingClientRect();
        const room = (el.offsetHeight - box.height) / 2;
        const offset = box.top + box.height / 2 - window.innerHeight / 2;
        const y = Math.max(-room, Math.min(room, -offset * k));
        el.style.transform = on ? `translate3d(0, ${y.toFixed(1)}px, 0)` : "none";
      });
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled, intensity]);

  return null;
}
