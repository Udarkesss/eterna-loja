"use client";

import { useEffect, useRef } from "react";

/**
 * EN: Scroll effects of design V3 ("Início — navegação"), each switched on or off in Gestão → Conteúdo → Imagem
 *     principal: the brand-coloured scrollbar (computers, every store page), and on the home page the progress bar at
 *     the top and sections that appear smoothly. "Reduce motion" keeps the sections still.
 * PT: Efeitos de scroll do V3, cada um ligado ou desligado na gestão: a scrollbar na cor da marca (computador, todas as
 *     páginas da loja) e, no Início, a barra de progresso no topo e as secções que aparecem suavemente. "Reduzir
 *     movimento" deixa as secções paradas.
 */
export function BrandScrollbar({ on }: { on: boolean }) {
  useEffect(() => {
    document.documentElement.classList.toggle("brand-scrollbar", on);
    return () => document.documentElement.classList.remove("brand-scrollbar");
  }, [on]);
  return null;
}

export function ScrollEffects({ progress, reveal }: { progress: boolean; reveal: boolean }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!progress) return;
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : 0})`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [progress]);

  useEffect(() => {
    if (!reveal || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const items = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    // EN: What is already on screen stays visible (no flash). PT: O que já está no ecrã fica visível (sem piscar).
    for (const el of items) if (el.getBoundingClientRect().top < window.innerHeight) el.dataset.in = "";
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.in = "";
          observer.unobserve(e.target);
        }
      },
      { threshold: 0.12 },
    );
    for (const el of items) if (!("in" in el.dataset)) observer.observe(el);
    document.documentElement.classList.add("reveal-on");
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("reveal-on");
    };
  }, [reveal]);

  return progress ? <div ref={bar} className="scroll-progress" aria-hidden="true" /> : null;
}
