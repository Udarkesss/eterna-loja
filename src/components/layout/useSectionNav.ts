"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

/** EN: Home sections the menu points to (design V3, "Início — navegação"). PT: Secções do Início ligadas no menu. */
export const HOME_SECTIONS = ["colecao", "ocasioes", "noivas", "acessorios", "modeladores", "sobre", "contactos"] as const;

const headerHeight = () => document.querySelector("header")?.getBoundingClientRect().height ?? 0;

/** EN: Position in the page without transforms (sections fading in move 28 px). PT: Posição sem transformações. */
function pageTop(el: HTMLElement): number {
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
  return y;
}

/**
 * EN: Menu behaviour of design V3: on the home page each item scrolls smoothly to its section (below the sticky header)
 *     and the section in view is marked; on other pages it opens the home page at that section. From the section the
 *     visitor then enters the pages. The logo scrolls back to the top.
 * PT: Comportamento do menu do V3: no Início cada item desliza até à sua secção (por baixo do cabeçalho fixo) e a
 *     secção à vista fica marcada; noutras páginas abre o Início nessa secção. Da secção entra-se depois nas páginas.
 *     O logótipo volta ao topo.
 */
export function useSectionNav() {
  const { locale } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const onHome = pathname === `/${locale}` || pathname === `/${locale}/`;
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!onHome) return setActive("");
    let ticking = false;
    const update = () => {
      ticking = false;
      const limit = headerHeight() + 24;
      let current = "";
      for (const id of HOME_SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - limit <= 0) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [onHome]);

  const go = useCallback(
    (id: string) => {
      if (!onHome) return router.push(`/${locale}${id ? `#${id}` : ""}`);
      const el = id ? document.getElementById(id) : null;
      const wrapper = el?.closest<HTMLElement>("[data-reveal]");
      if (wrapper) wrapper.dataset.in = "";
      const top = el ? pageTop(el) - headerHeight() + 1 : 0;
      window.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      window.history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    },
    [onHome, locale, router],
  );

  return { active, go, onHome };
}
