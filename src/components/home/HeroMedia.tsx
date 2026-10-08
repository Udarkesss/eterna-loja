"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/i18n/I18nProvider";
import styles from "./Home.module.css";

export interface HeroData {
  media: "video" | "image";
  videoDesktop: string;
  videoMobile: string;
  poster: string;
  posterMobile: string;
  image: string;
  videoLabel: string;
  imageAlt: string;
  videoBadge: string;
  imageBadge: string;
  parallax: boolean;
  parallaxIntensity: number;
  autoplay?: boolean; // EN: Gestão · 9 "Reprodução automática" (default on). PT: por omissão ligado.
  loop?: boolean; // EN: Gestão · 9 "Em loop" (default on). PT: por omissão ligado.
}

/**
 * EN: "Imagem principal": muted looping video (or an image), with a badge and a pause button (always visible,
 *     for accessibility). Phones get the vertical video; slow connections / data saver get the still image.
 * PT: "Imagem principal": vídeo sem som em ciclo (ou imagem), com selo e botão de pausa (sempre visível).
 *     O telemóvel recebe o vídeo vertical; internet lenta ou poupança de dados recebe a imagem parada.
 */
export function HeroMedia({ data }: { data: HeroData }) {
  const { dict } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(data.autoplay !== false);
  const [source, setSource] = useState<{ src: string; poster: string } | null>(null);
  const [stillOnly, setStillOnly] = useState(false);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!connection?.saveData || /2g/.test(connection?.effectiveType ?? "");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    setStillOnly(slow);
    setSource(phone ? { src: data.videoMobile, poster: data.posterMobile } : { src: data.videoDesktop, poster: data.poster });
    if (reduce) setPlaying(false);
  }, [data.videoDesktop, data.videoMobile, data.poster, data.posterMobile]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing, source]);

  const isVideo = data.media === "video" && !stillOnly;

  return (
    <section className={styles.hero} aria-label={isVideo ? data.videoBadge : data.imageBadge}>
      {isVideo && source ? (
        <video
          ref={video}
          key={source.src}
          data-parallax=""
          className={styles.heroMedia}
          muted
          loop={data.loop !== false}
          playsInline
          autoPlay={playing}
          preload="metadata"
          poster={source.poster}
          aria-label={data.videoLabel}
        >
          <source src={source.src} type="video/mp4" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- EN: parallax needs a plain image. PT: o parallax precisa de <img>.
        <img
          data-parallax=""
          className={styles.heroMedia}
          src={data.media === "video" ? (source?.poster ?? data.poster) : data.image}
          alt={data.media === "video" ? data.videoLabel : data.imageAlt}
        />
      )}
      <span className={styles.heroBadge}>{isVideo || data.media === "video" ? data.videoBadge : data.imageBadge}</span>
      {isVideo && (
        <button
          type="button"
          className={styles.heroPlay}
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? dict.home.pauseVideo : dict.home.playVideo}
        >
          <Icon name={playing ? "pause" : "play"} size={16} />
        </button>
      )}
    </section>
  );
}
