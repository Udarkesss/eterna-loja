"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./AnnouncementBar.module.css";

/**
 * EN: Announcement bar in "auto" mode: it floats over the page (the page does not get taller), hides when scrolling
 *     down and comes back when scrolling up or at the top. While it shows, the sticky header moves down below it
 *     (--ann-offset, used by Header.module.css).
 * PT: Barra de anúncio no modo "auto": flutua sobre a página (a página não fica mais alta), esconde ao descer e volta
 *     ao subir ou no topo. Enquanto aparece, o cabeçalho fixo desce para debaixo dela (--ann-offset).
 */
export function AutoHideBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const h = ref.current?.offsetHeight ?? 40;
      if (y < 10 || y < last - 4) setShown(true);
      else if (y > last + 4 && y > h) setShown(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--ann-offset", shown ? `${ref.current?.offsetHeight ?? 0}px` : "0px");
    return () => {
      root.style.removeProperty("--ann-offset");
    };
  }, [shown]);

  return (
    <div ref={ref} className={`${styles.auto} ${shown ? "" : styles.autoHidden}`}>
      {children}
    </div>
  );
}
