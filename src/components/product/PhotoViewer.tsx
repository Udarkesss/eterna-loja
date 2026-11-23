"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./PhotoViewer.module.css";

/**
 * EN: Full-screen photos of a piece (owner 2026-11-23, like Zara): the page stays faintly visible behind, thumbnails
 *     on the side, arrows, ← → and Esc on the keyboard, swipe on phones. Opens on the photo that was clicked.
 * PT: Fotos da peça em ecrã inteiro (dona 23-11-2026, como na Zara): a página fica ligeiramente à vista por trás,
 *     miniaturas ao lado, setas, ← → e Esc no teclado, deslizar no telemóvel. Abre na foto em que se clicou.
 */
export function PhotoViewer({ images, start, onClose }: { images: { url: string; alt: string }[]; start: number; onClose: (index: number) => void }) {
  const { dict } = useI18n();
  const [index, setIndex] = useState(start);
  const track = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const current = useRef(start);
  current.current = index;

  const go = (i: number, smooth = true) => {
    const n = (i + images.length) % images.length;
    setIndex(n);
    const el = track.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const el = track.current;
    if (el) el.scrollLeft = start * el.clientWidth;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(current.current);
      else if (e.key === "ArrowRight") go(current.current + 1);
      else if (e.key === "ArrowLeft") go(current.current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus();
    };
    // EN: Once, when it opens. PT: Uma vez, ao abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // EN: Swiping on phones moves the track: keep the counter and thumbnails in step. PT: Ao deslizar, acerta o contador.
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== current.current) setIndex(i);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={dict.product.openPhoto} className={styles.viewer} onClick={(e) => e.target === e.currentTarget && onClose(index)}>
      {images.length > 1 && (
        <div className={styles.thumbs}>
          {images.map((img, i) => (
            <button key={img.url} type="button" className={styles.thumb} aria-label={t(dict.product.viewImage, { n: i + 1 })} aria-pressed={i === index} onClick={() => go(i)}>
              <Image src={img.url} alt="" fill sizes="64px" className={styles.cover} />
            </button>
          ))}
        </div>
      )}
      <div ref={track} className={styles.track} onScroll={onScroll} onClick={(e) => e.target === e.currentTarget && onClose(index)}>
        {images.map((img, i) => (
          <div key={img.url} className={styles.slide} onClick={(e) => e.target === e.currentTarget && onClose(index)}>
            <div className={styles.frame}>
              <Image src={img.url} alt={img.alt} fill sizes="100vw" priority={i === start} className={styles.photo} />
            </div>
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className={`${styles.arrow} ${styles.prev}`} aria-label={dict.product.prevPhoto} onClick={() => go(index - 1)}>
            <Icon name="chevronLeft" size={22} />
          </button>
          <button type="button" className={`${styles.arrow} ${styles.next}`} aria-label={dict.product.nextPhoto} onClick={() => go(index + 1)}>
            <Icon name="chevronRight" size={22} />
          </button>
          <span className={styles.count}>{t(dict.product.photoCount, { n: index + 1, total: images.length })}</span>
        </>
      )}
      <button ref={close} type="button" className={styles.close} aria-label={dict.common.close} onClick={() => onClose(index)}>
        <Icon name="close" size={22} />
      </button>
    </div>,
    document.body,
  );
}
