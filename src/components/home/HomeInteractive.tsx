"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { RichText } from "@/components/ui/RichText";
import { useI18n } from "@/i18n/I18nProvider";
import { resolveHref } from "@/lib/links";
import styles from "./HomeV3.module.css";

/**
 * EN: Interactive pieces of the V3 home page (videos with pause, carousel, "more occasions", accessories tabs).
 *     Videos respect "reduce motion" and data saver (they start paused / show the poster).
 * PT: Partes interactivas do Início V3. Os vídeos respeitam "reduzir movimento" e a poupança de dados.
 */

function useAutoplay(initial: boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(initial);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) setPlaying(false);
  }, []);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
  }, [playing]);
  return { video, playing, setPlaying };
}

export interface HeroV3Data {
  videoDesktop: string;
  poster: string;
  videoLabel: string;
  videoBadge: string;
  showTitle?: boolean;
  title?: string;
  cta?: { label: string; href: string };
  autoplay?: boolean;
  loop?: boolean;
}

/**
 * EN: Hero of design V3: the 16:9 video, never cropped on computers; on phones the whole video sits over a blurred
 *     copy of its poster. Label + title + button bottom-left ("com frase") or only the label pill.
 * PT: Topo do V3: o vídeo 16:9, sem corte no computador; no telemóvel o vídeo inteiro sobre o cartaz desfocado.
 *     Etiqueta + frase + botão em baixo à esquerda ("com frase") ou só a cápsula da etiqueta.
 */
export function HeroV3({ data }: { data: HeroV3Data }) {
  const { dict, locale } = useI18n();
  const { video, playing, setPlaying } = useAutoplay(data.autoplay !== false);
  return (
    <section className={styles.hero} aria-label={data.videoLabel}>
      <Image src={data.poster} alt="" fill sizes="100vw" className={styles.heroBlur} aria-hidden="true" />
      <video
        ref={video}
        className={styles.heroVideo}
        muted
        loop={data.loop !== false}
        playsInline
        preload="metadata"
        poster={data.poster}
        aria-label={data.videoLabel}
      >
        <source src={data.videoDesktop} type="video/mp4" />
      </video>
      {data.showTitle !== false && data.title ? (
        <>
          <span className={styles.heroScrim} aria-hidden="true" />
          <div className={styles.heroText}>
            <span className={styles.eyebrowLight}>{data.videoBadge}</span>
            <h1 className={styles.heroTitle}>
              <RichText text={data.title} />
            </h1>
            {data.cta && (
              <Link href={resolveHref(data.cta.href, locale)} className={styles.btnLight}>
                {data.cta.label}
              </Link>
            )}
          </div>
        </>
      ) : (
        <span className={styles.heroPill}>{data.videoBadge}</span>
      )}
      <button type="button" className={styles.pause} aria-label={playing ? dict.home.pauseVideo : dict.home.playVideo} onClick={() => setPlaying(!playing)}>
        <Icon name={playing ? "pause" : "play"} size={18} />
      </button>
    </section>
  );
}

export interface HeroSlide {
  image: string;
  position: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: string;
  href: string;
  on: boolean;
}

const SLIDE_SECONDS = 7;

/**
 * EN: Hero in "Slides" mode (design V3, chosen in Gestão): photos that fade into each other, each with overline,
 *     title, line and button. Computer: "01 / 03", dashes and arrows bottom-right; phone: dashes across the bottom.
 *     With "Avançar sozinho" on, it moves every 7 s and shows a pause button; never with "reduce motion".
 * PT: Topo em modo "Slides" (V3, escolhido na gestão): fotografias que se fundem, cada uma com sobretítulo, título,
 *     frase e botão. Computador: "01 / 03", traços e setas em baixo à direita; telemóvel: traços em toda a largura.
 *     Com "Avançar sozinho" ligado, muda a cada 7 s e mostra pausa; nunca com "reduzir movimento".
 */
export function HeroSlides({ slides, auto }: { slides: HeroSlide[]; auto: boolean }) {
  const { dict, locale } = useI18n();
  const h = dict.home;
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(auto);
  const count = slides.length;
  const pad = (n: number) => String(n).padStart(2, "0");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);
  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % count), SLIDE_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [playing, count, current]);

  return (
    <section className={styles.slides} aria-roledescription={h.carousel} aria-label={h.highlights}>
      {slides.map((s, i) => (
        <div key={i} className={styles.slide} aria-hidden={i !== current} data-on={i === current} inert={i !== current}>
          <Image src={s.image} alt="" fill priority={i === 0} sizes="100vw" style={{ objectPosition: s.position }} />
          <span className={styles.slideScrim} aria-hidden="true" />
          <div className={styles.slideText}>
            {s.eyebrow && <span className={styles.eyebrowLight}>{s.eyebrow}</span>}
            {i === 0 ? (
              <h1 className={styles.slideTitle}>
                <RichText text={s.title} />
              </h1>
            ) : (
              <h2 className={styles.slideTitle}>
                <RichText text={s.title} />
              </h2>
            )}
            {s.text && <p className={styles.slideLine}>{s.text}</p>}
            {s.cta && s.href && (
              <Link href={resolveHref(s.href, locale)} className={styles.btnLight}>
                {s.cta}
              </Link>
            )}
          </div>
        </div>
      ))}
      {count > 1 && (
        <div className={styles.slideControls}>
          <span className={styles.slideCount} aria-live="polite">
            {pad(current + 1)} / {pad(count)}
          </span>
          <div className={styles.dashes}>
            {slides.map((s, i) => (
              <button
                key={i}
                type="button"
                className={styles.dash}
                aria-current={i === current ? "true" : undefined}
                aria-label={`${h.slide} ${i + 1}: ${s.title.replace(/\*/g, "")}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
          {auto && (
            <button type="button" className={styles.ctrl} aria-label={playing ? h.pauseSlides : h.playSlides} onClick={() => setPlaying(!playing)}>
              <Icon name={playing ? "pause" : "play"} size={16} />
            </button>
          )}
          <button type="button" className={`${styles.ctrl} ${styles.arrow}`} aria-label={h.prevSlide} onClick={() => setCurrent((current + count - 1) % count)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className={`${styles.ctrl} ${styles.arrow}`} aria-label={h.nextSlide} onClick={() => setCurrent((current + 1) % count)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      )}
    </section>
  );
}

/** EN: Bridal video band (parallax), pill and pause. PT: Faixa em vídeo da Bridal, cápsula e pausa. */
export function VideoBand({ src, poster, label, pill }: { src: string; poster: string; label: string; pill: string }) {
  const { dict } = useI18n();
  const { video, playing, setPlaying } = useAutoplay(true);
  return (
    <div className={styles.band}>
      <div className={styles.parallaxLayer} data-parallax="">
        <video ref={video} muted loop playsInline preload="metadata" poster={poster} aria-label={label}>
          <source src={src} type="video/mp4" />
        </video>
      </div>
      <span className={styles.bandPill}>{pill}</span>
      <button type="button" className={styles.bandPause} aria-label={playing ? dict.home.pauseVideo : dict.home.playVideo} onClick={() => setPlaying(!playing)}>
        <Icon name={playing ? "pause" : "play"} size={16} />
      </button>
    </div>
  );
}

/** EN: Horizontal carousel with previous / next buttons. PT: Carrossel horizontal com anterior / seguinte. */
export function Carousel({ head, children }: { head: ReactNode; children: ReactNode }) {
  const { dict } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const move = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <>
      <div className={styles.carouselHead}>
        {head}
        <div className={styles.carouselButtons}>
          <button type="button" className={styles.round} aria-label={dict.home.previous} onClick={() => move(-1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className={styles.round} aria-label={dict.home.next} onClick={() => move(1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
      <div ref={track} className={styles.track}>
        {children}
      </div>
    </>
  );
}

/** EN: "Mais ocasiões" — opens the rest of the mosaic smoothly. PT: Abre o resto do mosaico com suavidade. */
export function MoreOccasions({ children }: { children: ReactNode }) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={`${styles.occMore} ${open ? styles.occMoreOpen : ""}`} aria-hidden={!open}>
        {children}
      </div>
      <button type="button" className={styles.vButton} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open ? dict.home.lessOccasions : dict.home.moreOccasions}</span>
        <svg width="44" height="18" viewBox="0 0 44 18" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }}>
          <path d="M2 3l20 12L42 3" />
        </svg>
      </button>
    </>
  );
}

export interface AccessoryTab {
  label: string;
  body: string;
  linkLabel: string;
  href: string;
  image: string;
  contain?: boolean;
}

/**
 * EN: Accessories section: one picture and the Festa / Executivos selector, which changes by itself every N seconds
 *     (set in the back-office) until the visitor picks one.
 * PT: Secção Acessórios: uma imagem e o seletor Festa / Executivos, que troca sozinho a cada N segundos (definido na
 *     gestão) até a visitante escolher um.
 */
export function AccessoriesTabs({ eyebrow, title, tabs, seconds }: { eyebrow: string; title: string; tabs: AccessoryTab[]; seconds: number }) {
  const { dict, locale } = useI18n();
  const [current, setCurrent] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || tabs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setCurrent((c) => (c + 1) % tabs.length), Math.max(3, seconds) * 1000);
    return () => window.clearInterval(id);
  }, [auto, seconds, tabs.length]);
  const tab = tabs[current];
  return (
    <section id="acessorios" className={styles.split}>
      {/* EN: The photo opens the tab's page, with the Bridal hover (owner 2026-11-22). PT: A foto abre a página do
          separador, com o efeito das Noivas (dona 22-11-2026). */}
      <Link href={resolveHref(tab.href, locale)} className={`${styles.splitImage} ${styles.photoLink}`} tabIndex={-1} aria-hidden="true">
        {tabs.map((t, i) => (
          <Image
            key={t.image}
            src={t.image}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className={`${styles.fadeImage} ${t.contain ? styles.contain : ""}`}
            style={{ opacity: i === current ? 1 : 0 }}
          />
        ))}
        <span className={styles.photoShade} />
        <span className={styles.photoCta}>{tab.linkLabel}</span>
      </Link>
      <div className={styles.splitText}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className={styles.title44}>
          <RichText text={title} />
        </h2>
        <div role="tablist" aria-label={eyebrow} className={styles.accTabs}>
          {tabs.map((t, i) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={i === current}
              className={styles.accTab}
              onClick={() => {
                setCurrent(i);
                setAuto(false);
              }}
            >
              {t.label}
            </button>
          ))}
          {auto && tabs.length > 1 && <span className={styles.accTimer}>{dict.home.changesEvery.replace("{s}", String(seconds))}</span>}
        </div>
        <div role="tabpanel">
          <p className={styles.muted}>{tab.body}</p>
          <Link href={resolveHref(tab.href, locale)} className={styles.ulink}>
            {tab.linkLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
