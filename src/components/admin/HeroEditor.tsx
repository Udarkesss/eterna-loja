"use client";

import { useState, useTransition } from "react";
import { saveHeroAction, saveTilesAction, type ContentResult } from "@/app/gestao/actions/content";
import { Icon } from "@/components/ui/Icon";
import type { Localized } from "@/types";
import s from "./admin.module.css";
import { MediaField } from "./FieldEditor";

/**
 * EN: "Gestão · 9": hero media (video or image, with phone versions and the slow-connection image), video options,
 *     parallax (on/off + intensity) and the "Ocasiões especiais" mosaic (order, size, image, text, link).
 * PT: Media da imagem principal (vídeo ou imagem, versões para telemóvel e imagem para internet lenta), opções do
 *     vídeo, parallax e o mosaico "Ocasiões especiais".
 */

interface Tile {
  id?: string;
  name: Localized;
  phrase: Localized;
  imageUrl: string;
  categoryId: string | null;
  size: "large" | "tall" | "normal";
}

interface Slide {
  image: string;
  position: string;
  eyebrow: Localized;
  title: Localized;
  text: Localized;
  cta: Localized;
  href: string;
  on: boolean;
}

const SIZES = { large: "Grande (2×2)", tall: "Alto (1×2)", normal: "Normal (1×1)" } as const;
const POSITIONS = { "center 20%": "Topo", "center 35%": "Acima do centro", "center 50%": "Centro", "center 70%": "Abaixo do centro" } as const;
const SLIDE_TEXTS = [
  ["eyebrow", "Sobretítulo", 60],
  ["title", "Título", 60],
  ["text", "Frase", 140],
  ["cta", "Texto do botão", 32],
] as const;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const newSlide = (): Slide => ({
  image: "/images/v3/s-festa.webp",
  position: "center 35%",
  eyebrow: { pt: "", en: "" },
  title: { pt: "Novo slide", en: "New slide" },
  text: { pt: "", en: "" },
  cta: { pt: "Ver mais", en: "See more" },
  href: "",
  on: false,
});

export function HeroEditor({
  hero,
  tiles: initialTiles,
  targets,
}: {
  hero: Record<string, unknown>;
  tiles: Tile[];
  targets: { id: string; slug: string; name: string; kind: string }[];
}) {
  const [h, setH] = useState({
    media: (hero.media === "slides" || hero.media === "image" ? "slides" : "video") as "video" | "slides",
    slides: (Array.isArray(hero.slides) ? hero.slides : []) as Slide[],
    slidesAuto: hero.slidesAuto === true,
    videoDesktop: str(hero.videoDesktop),
    videoMobile: str(hero.videoMobile),
    poster: str(hero.poster),
    posterMobile: str(hero.posterMobile),
    image: str(hero.image),
    autoplay: hero.autoplay !== false,
    loop: hero.loop !== false,
    parallax: hero.parallax !== false,
    parallaxIntensity: typeof hero.parallaxIntensity === "number" ? hero.parallaxIntensity : 0.25,
  });
  const [tiles, setTiles] = useState(initialTiles);
  const [sel, setSel] = useState(0);
  const [slideSel, setSlideSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ContentResult | null>(null);
  const [pending, start] = useTransition();
  const setHero = (patch: Partial<typeof h>) => {
    setH({ ...h, ...patch });
    setDirty(true);
    setResult(null);
  };
  const setT = (next: Tile[]) => {
    setTiles(next);
    setDirty(true);
    setResult(null);
  };
  const cur = tiles[sel];
  const slide = h.slides[slideSel];
  const setSlide = (patch: Partial<Slide>) => setHero({ slides: h.slides.map((x, j) => (j === slideSel ? { ...x, ...patch } : x)) });
  const moveSlide = (i: number, d: number) => {
    const a = [...h.slides];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setHero({ slides: a });
    setSlideSel(j);
  };
  const pct = Math.round(h.parallaxIntensity * 200); // EN: 0.5 = strongest. PT: 0,5 = mais forte.
  const pxLabel = pct <= 30 ? "subtil" : pct <= 65 ? "moderado" : "forte";

  const publish = () =>
    start(async () => {
      const a = await saveHeroAction(h);
      const b = a.ok ? await saveTilesAction(tiles) : a;
      setResult(b);
      if (b.ok) setDirty(false);
    });

  const move = (i: number, d: number) => {
    const a = [...tiles];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    setT(a);
    setSel(j);
  };

  return (
    <>
      <div className={s.top} style={{ marginTop: -16 }}>
        <div className={s.actions}>
          {dirty && <span className={s.chip} data-tone="warn">Alterações por publicar</span>}
          {result && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓ Publicado" : result.message}</span>}
        </div>
        <div className={s.actions}>
          <a href="/pt" target="_blank" className={s.btnOutline}>
            <Icon name="eye" size={16} />
            Pré-visualizar
          </a>
          <button className={s.btn} disabled={pending || !dirty} onClick={publish}>
            Publicar
          </button>
        </div>
      </div>

      <section className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Imagem principal</h2>
          <div className={s.segment} role="radiogroup" aria-label="Modo do topo">
            {(["slides", "video"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={h.media === m} onClick={() => setHero({ media: m })}>
                {m === "video" ? "Vídeo" : "Slides"}
              </button>
            ))}
          </div>
        </div>
        {h.media === "video" ? (
          <div className={s.split2}>
            <div className={s.fieldset}>
              <MediaField name="Vídeo para computador" value={h.videoDesktop} onChange={(v) => setHero({ videoDesktop: v })} />
              <MediaField name="Vídeo para telemóvel (vertical)" value={h.videoMobile} onChange={(v) => setHero({ videoMobile: v })} />
              <MediaField name="Imagem de capa" value={h.poster} onChange={(v) => setHero({ poster: v })} />
              <MediaField name="Imagem para internet lenta (telemóvel)" value={h.posterMobile} onChange={(v) => setHero({ posterMobile: v })} />
              <span className={s.hint}>MP4 (H.264) até 8 MB, 15–30 s, sem legendas gravadas na imagem.</span>
            </div>
            <div className={s.fieldset}>
              <span className={s.legend}>Pré-visualização</span>
              {h.videoDesktop && <video key={h.videoDesktop} src={h.videoDesktop} poster={h.poster} muted loop autoPlay playsInline style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "var(--blush-light)" }} />}
              <fieldset className={s.fieldset}>
                <legend className={s.legend}>Opções do vídeo</legend>
                <label className={s.check}>
                  <input type="checkbox" checked={h.autoplay} onChange={() => setHero({ autoplay: !h.autoplay })} />
                  Reprodução automática — começa sozinho ao abrir a página
                </label>
                <label className={s.check}>
                  <input type="checkbox" checked disabled />
                  Sem som — obrigatório para reprodução automática
                </label>
                <label className={s.check}>
                  <input type="checkbox" checked={h.loop} onChange={() => setHero({ loop: !h.loop })} />
                  Em loop — recomeça no fim
                </label>
                <label className={s.check}>
                  <input type="checkbox" checked disabled />
                  Botão de pausa visível — sempre ligado, por acessibilidade
                </label>
              </fieldset>
            </div>
          </div>
        ) : (
          <div className={s.split2}>
            <div className={s.fieldset}>
              <ol className={s.list}>
                {h.slides.map((x, i) => (
                  <li key={i} className={s.listItem} style={{ alignItems: "center", background: i === slideSel ? "var(--blush-light)" : undefined, padding: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- EN: small preview. PT: pré-visualização. */}
                    <img src={x.image} alt="" style={{ width: 80, height: 45, objectFit: "cover", objectPosition: x.position }} />
                    <button type="button" className={s.two} style={{ flexGrow: 1, border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => setSlideSel(i)} aria-pressed={i === slideSel}>
                      <span className={s.strong}>{x.title.pt || "Sem título"}</span>
                      <span className={s.muted}>{x.href ? `Ligação: ${x.href}` : "Sem ligação"}</span>
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={x.on}
                      aria-label={x.on ? `Desligar ${x.title.pt}` : `Ligar ${x.title.pt}`}
                      className={s.switch}
                      onClick={() => setHero({ slides: h.slides.map((y, j) => (j === i ? { ...y, on: !y.on } : y)) })}
                    />
                    <button className={`${s.btnOutline} ${s.small}`} disabled={i === 0} onClick={() => moveSlide(i, -1)} aria-label={`Subir ${x.title.pt}`}>
                      <Icon name="arrowUp" size={14} />
                    </button>
                    <button className={`${s.btnOutline} ${s.small}`} disabled={i === h.slides.length - 1} onClick={() => moveSlide(i, 1)} aria-label={`Descer ${x.title.pt}`}>
                      <Icon name="arrowDown" size={14} />
                    </button>
                    <button
                      className={`${s.btnDanger} ${s.small}`}
                      onClick={() => {
                        if (window.confirm(`Remover o slide ${x.title.pt}?`)) {
                          setHero({ slides: h.slides.filter((_, j) => j !== i) });
                          setSlideSel(0);
                        }
                      }}
                      aria-label={`Remover ${x.title.pt}`}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ol>
              <button
                className={`${s.btnOutline} ${s.small}`}
                style={{ alignSelf: "flex-start" }}
                disabled={h.slides.length >= 8}
                onClick={() => {
                  setHero({ slides: [...h.slides, newSlide()] });
                  setSlideSel(h.slides.length);
                }}
              >
                <Icon name="plus" size={14} />
                Adicionar slide
              </button>
              <span className={s.hint}>
                Imagem 16:9, mínimo 2400 × 1350 px, JPG ou WebP até 2 MB. Só aparecem os slides ligados; um slide novo começa desligado.
              </span>
              <label className={s.check}>
                <input type="checkbox" checked={h.slidesAuto} onChange={() => setHero({ slidesAuto: !h.slidesAuto })} />
                Avançar sozinho a cada 7 s (com botão de pausa)
              </label>
            </div>
            <div className={s.fieldset}>
              {!slide ? (
                <p className={s.muted}>Adicione um slide para o editar.</p>
              ) : (
                <>
                  <span className={s.legend}>Editar · {slide.title.pt || "slide"}</span>
                  <MediaField name="Imagem (16:9)" value={slide.image} onChange={(v) => setSlide({ image: v })} />
                  <label className={s.label}>
                    Enquadramento da imagem
                    <select className={s.select} value={slide.position} onChange={(e) => setSlide({ position: e.target.value })}>
                      {!(slide.position in POSITIONS) && <option value={slide.position}>Personalizado ({slide.position})</option>}
                      {Object.entries(POSITIONS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  {SLIDE_TEXTS.map(([key, label, max]) => (
                    <div key={key} className={s.row2}>
                      {(["pt", "en"] as const).map((l) => (
                        <label key={l} className={s.label}>
                          {label} ({l.toUpperCase()})
                          <input className={s.input} maxLength={max} value={slide[key][l]} onChange={(e) => setSlide({ [key]: { ...slide[key], [l]: e.target.value } })} />
                        </label>
                      ))}
                    </div>
                  ))}
                  <label className={s.label}>
                    Ligação do botão
                    <select
                      className={s.select}
                      value={targets.some((t) => `category:${t.slug}` === slide.href) ? slide.href : ""}
                      onChange={(e) => e.target.value && setSlide({ href: e.target.value })}
                    >
                      <option value="">Escolher uma colecção, ocasião ou departamento…</option>
                      {targets.map((t) => (
                        <option key={t.id} value={`category:${t.slug}`}>
                          {t.kind === "occasion" ? "Ocasiões · " : t.kind === "collection" ? "Colecção · " : ""}
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={s.label}>
                    Ou escreva a ligação
                    <input className={s.input} value={slide.href} onChange={(e) => setSlide({ href: e.target.value })} placeholder="category:essenza · product:7g184 · /fidelidade" />
                    <span className={s.hint}>Peça: product: e o código em minúsculas. Página: o endereço começado por /.</span>
                  </label>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <section className={s.card}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Parallax</h2>
          <button type="button" role="switch" aria-checked={h.parallax} aria-label={h.parallax ? "Desligar parallax" : "Ligar parallax"} className={s.switch} onClick={() => setHero({ parallax: !h.parallax })} />
        </div>
        <span className={s.muted}>O fundo move-se mais devagar do que o texto ao fazer scroll.</span>
        {h.parallax && (
          <label className={s.label}>
            Intensidade: {pxLabel} ({pct})
            <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setHero({ parallaxIntensity: Number(e.target.value) / 200 })} />
          </label>
        )}
        <div className={s.notice}>Quem pediu “reduzir movimento” no telemóvel ou computador vê sempre as imagens paradas, com o efeito ligado ou não.</div>
      </section>

      <div className={s.split2} id="ocasioes">
        <section className={s.card}>
          <div className={s.cardHead}>
            <h2 className={s.h2}>Ocasiões especiais</h2>
            <span className={s.muted}>{tiles.length} ocasiões</span>
          </div>
          <ol className={s.list}>
            {tiles.map((t, i) => (
              <li key={t.id ?? `n${i}`} className={s.listItem} style={{ alignItems: "center", background: i === sel ? "var(--blush-light)" : undefined, padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- EN: small preview. PT: pré-visualização. */}
                <img src={t.imageUrl} alt="" style={{ width: 44, height: 55, objectFit: "cover" }} />
                <button type="button" className={s.two} style={{ flexGrow: 1, border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => setSel(i)} aria-pressed={i === sel}>
                  <span className={s.strong}>{t.name.pt || "Nova ocasião"}</span>
                  <span className={s.muted}>
                    {SIZES[t.size]} · {t.phrase.pt}
                  </span>
                </button>
                <button className={`${s.btnOutline} ${s.small}`} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Subir ${t.name.pt}`}>
                  <Icon name="arrowUp" size={14} />
                </button>
                <button className={`${s.btnOutline} ${s.small}`} disabled={i === tiles.length - 1} onClick={() => move(i, 1)} aria-label={`Descer ${t.name.pt}`}>
                  <Icon name="arrowDown" size={14} />
                </button>
                <button
                  className={`${s.btnDanger} ${s.small}`}
                  onClick={() => {
                    if (window.confirm(`Remover a ocasião ${t.name.pt}?`)) {
                      setT(tiles.filter((_, j) => j !== i));
                      setSel(0);
                    }
                  }}
                  aria-label={`Remover ${t.name.pt}`}
                >
                  Remover
                </button>
              </li>
            ))}
          </ol>
          <button
            className={`${s.btnOutline} ${s.small}`}
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              setT([...tiles, { name: { pt: "Nova ocasião", en: "New occasion" }, phrase: { pt: "", en: "" }, imageUrl: "/images/content/hero-poster.jpg", categoryId: null, size: "normal" }]);
              setSel(tiles.length);
            }}
          >
            <Icon name="plus" size={14} />
            Adicionar ocasião
          </button>
        </section>

        <section className={s.card}>
          <h2 className={s.h2}>{cur ? `Editar · ${cur.name.pt}` : "Editar ocasião"}</h2>
          {!cur ? (
            <p className={s.muted}>Escolha uma ocasião na lista para a editar.</p>
          ) : (
            <>
              <MediaField name="Imagem (vertical 4:5)" value={cur.imageUrl} onChange={(v) => setT(tiles.map((x, j) => (j === sel ? { ...x, imageUrl: v } : x)))} />
              <div className={s.row2}>
                {(["pt", "en"] as const).map((l) => (
                  <label key={l} className={s.label}>
                    Nome ({l.toUpperCase()})
                    <input className={s.input} maxLength={28} value={cur.name[l]} onChange={(e) => setT(tiles.map((x, j) => (j === sel ? { ...x, name: { ...x.name, [l]: e.target.value } } : x)))} />
                  </label>
                ))}
                {(["pt", "en"] as const).map((l) => (
                  <label key={`p${l}`} className={s.label}>
                    Frase curta ({l.toUpperCase()})
                    <input className={s.input} maxLength={50} value={cur.phrase[l]} onChange={(e) => setT(tiles.map((x, j) => (j === sel ? { ...x, phrase: { ...x.phrase, [l]: e.target.value } } : x)))} />
                    <span className={s.hint}>{cur.phrase[l].length} de 50 caracteres</span>
                  </label>
                ))}
              </div>
              <div className={s.row2}>
                <label className={s.label}>
                  Leva a
                  <select className={s.select} value={cur.categoryId ?? ""} onChange={(e) => setT(tiles.map((x, j) => (j === sel ? { ...x, categoryId: e.target.value || null } : x)))}>
                    <option value="">—</option>
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.kind === "occasion" ? "Ocasiões · " : t.kind === "collection" ? "Colecção · " : ""}
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.label}>
                  Tamanho no mosaico
                  <select className={s.select} value={cur.size} onChange={(e) => setT(tiles.map((x, j) => (j === sel ? { ...x, size: e.target.value as Tile["size"] } : x)))}>
                    {Object.entries(SIZES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
