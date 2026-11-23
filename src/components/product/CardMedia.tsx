"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./ProductCard.module.css";

/**
 * EN: Photo of a product card. With more than one photo it can be changed in the list (owner 2026-11-23): small arrows
 *     on hover (computer), swipe on phones (not inside a carousel, where swiping moves the carousel) and dots below.
 * PT: Foto do cartão da peça. Com mais de uma foto pode trocar-se na lista (dona 23-11-2026): setas pequenas ao passar
 *     o rato (computador), deslizar no telemóvel (não dentro de um carrossel, onde deslizar mexe o carrossel) e pontos.
 */
export function CardMedia({
  href,
  images,
  alt,
  sizes,
  priority,
  swipe = true,
  children,
}: {
  href: string;
  images: string[];
  alt: string;
  sizes: string;
  priority: boolean;
  swipe?: boolean;
  children?: ReactNode;
}) {
  const { dict } = useI18n();
  const track = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);
  const many = images.length > 1;

  const go = (i: number) => {
    const n = (i + images.length) % images.length;
    setIndex(n);
    const el = track.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <span className={styles.mediaWrap}>
      <Link href={href} className={styles.media} tabIndex={-1} aria-hidden="true">
        <span ref={track} className={`${styles.track} ${swipe ? styles.trackSwipe : ""}`} onScroll={onScroll}>
          {(many ? images : images.slice(0, 1)).map((src, i) => (
            <span key={src} className={styles.frame}>
              <Image src={src} alt={i === 0 ? alt : ""} fill sizes={sizes} priority={priority && i === 0} className={styles.image} />
            </span>
          ))}
        </span>
        {children}
      </Link>
      {many && (
        <>
          <button type="button" className={`${styles.arrow} ${styles.arrowPrev}`} aria-label={dict.product.prevPhoto} onClick={() => go(index - 1)}>
            <Icon name="chevronLeft" size={14} />
          </button>
          <button type="button" className={`${styles.arrow} ${styles.arrowNext}`} aria-label={dict.product.nextPhoto} onClick={() => go(index + 1)}>
            <Icon name="chevronRight" size={14} />
          </button>
          <span className={styles.dots}>
            {images.map((src, i) => (
              <button key={src} type="button" className={styles.dot} aria-label={t(dict.product.viewImage, { n: i + 1 })} aria-pressed={i === index} onClick={() => go(i)} />
            ))}
          </span>
        </>
      )}
    </span>
  );
}
