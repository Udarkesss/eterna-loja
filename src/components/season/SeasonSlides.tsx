"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import styles from "./Season.module.css";

/** EN: "Slides" image of a time of the year: photos that pass by themselves, with arrows. PT: Fotos que passam sozinhas, com setas. */
export function SeasonSlides({ images }: { images: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((x) => (x + 1) % images.length), 6000);
    return () => clearInterval(id);
  }, [images.length]);
  return (
    <>
      {images.map((src, n) => (
        <Image key={src} src={src} alt="" fill sizes="(max-width: 767px) 100vw, 50vw" className={styles.slide} style={{ opacity: n === i ? 1 : 0 }} />
      ))}
      {images.length > 1 && (
        <div className={styles.ctrl}>
          {images.map((src, n) => (
            <button key={src} type="button" className={styles.dot} data-on={n === i || undefined} aria-label={`Slide ${n + 1}`} onClick={() => setI(n)} />
          ))}
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.arrow} aria-label="Anterior" onClick={() => setI((x) => (x + images.length - 1) % images.length)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <button type="button" className={styles.arrow} aria-label="Seguinte" onClick={() => setI((x) => (x + 1) % images.length)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </>
  );
}
