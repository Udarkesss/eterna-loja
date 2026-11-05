"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { publishPageAction, saveHeroAction, saveSeasonsAction, saveTilesAction, type ContentResult } from "@/app/gestao/actions/content";
import type { Season } from "@/data/seasons";
import { Icon } from "@/components/ui/Icon";
import type { Localized } from "@/types";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";
import mob from "./Mobile.module.css";
import { FieldEditor, MediaField } from "./FieldEditor";
import { FrameButton } from "./FrameDialog";
import { SeasonsPanel } from "./SeasonsPanel";

/**
 * EN: "Gestão · Conteúdo do site" of design V3-G-Conteudo: the home sections (their order is the menu order; switching
 *     one off removes it from the menu), the hero (slides or video), the "entrada" phrase, the section covers and
 *     videos, the menu preview, the scroll effects and "Acabadas de chegar". One "Publicar alterações" saves it all.
 * PT: Conteúdo do site do V3: as secções do Início (a ordem é a ordem do menu; desligar uma tira-a do menu), o hero
 *     (slides ou vídeo), a frase da entrada, as capas e vídeos das secções, a pré-visualização do menu, os efeitos de
 *     scroll e "Acabadas de chegar". Um só "Publicar alterações" guarda tudo.
 */

export interface HomeSection {
  key: string;
  visible: boolean;
  data: Record<string, unknown>;
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
interface Tile {
  id?: string;
  name: Localized;
  phrase: Localized;
  imageUrl: string;
  categoryId: string | null;
  size: "large" | "tall" | "normal";
}
type Target = { id: string; slug: string; name: string; kind: string };

const FIXED = ["announcement", "hero"];
const INFO: Record<string, { name: string; menu: string; desc: string }> = {
  announcement: { name: "Barra de anúncio", menu: "—", desc: "Mostra a campanha activa ou a mensagem normal" },
  hero: { name: "Hero · vídeo ou slides", menu: "— (logótipo)", desc: "Sempre no topo · vídeo inteiro, sem corte · etiqueta, frase e botão (ou só etiqueta)" },
  entrada: { name: "Entrada · frase", menu: "—", desc: "Frase fixa; a mensagem e o botão vêm da colecção activa" },
  colecao: { name: "Colecção activa", menu: "(automático)", desc: "Capa de ponta a ponta que sobe e revela Festa / Executiva" },
  ocasioes: { name: "Ocasiões", menu: "Ocasiões", desc: "Ocasiões em mosaico · por baixo, acabadas de chegar (automático)" },
  novidades: { name: "Acabadas de chegar", menu: "—", desc: "As últimas peças publicadas (automático)" },
  noivas: { name: "Noivas · Eterna Bridal", menu: "Noivas", desc: "Faixa (vídeo ou foto) · duas colecções · experiência · faixa escura com o único “Marcar prova”" },
  acessorios: { name: "Acessórios", menu: "Acessórios", desc: "Uma imagem e seletor Festa / Executivos" },
  modeladores: { name: "Modeladores", menu: "Modeladores", desc: "Faixa simples: texto e uma imagem" },
  sobre: { name: "Sobre nós", menu: "Sobre nós", desc: "Fundadora, números, missão, equipa, história, Instagram" },
  contactos: { name: "Contacte-nos", menu: "Contacte-nos", desc: "Lojas, contactos e rodapé" },
};
const POSITIONS = { "center 20%": "Topo", "center 35%": "Acima do centro", "center 50%": "Centro", "center 70%": "Abaixo do centro" } as const;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const loc = (v: unknown): Localized => (v && typeof v === "object" && "pt" in (v as object) ? (v as Localized) : { pt: str(v), en: str(v) });
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

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  const sw = <button type="button" role="switch" aria-checked={on} aria-label={label} className={c.toggle} onClick={() => onChange(!on)} />;
  return label ? (
    <label className={c.toggleRow}>
      {sw}
      <span>{label}</span>
    </label>
  ) : (
    sw
  );
}

export function HomeContentEditor(props: {
  sections: HomeSection[];
  tiles: Tile[];
  targets: Target[];
  collection: { id: string; name: string; message: string | null; buttonText: string | null; imageUrl: string | null } | null;
  campaign: { name: string; placement: string } | null;
  seasons: Season[];
}) {
  const [sections, setSections] = useState(props.sections);
  const [tiles, setTiles] = useState(props.tiles);
  const [seasons, setSeasons] = useState(props.seasons);
  const [dirty, setDirty] = useState(false);
  const [res, setRes] = useState<ContentResult | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [slideSel, setSlideSel] = useState<number | null>(null);
  const [tileSel, setTileSel] = useState(0);

  const touch = () => {
    setDirty(true);
    setRes(null);
  };
  const sec = (key: string) => sections.find((x) => x.key === key);
  const setData = (key: string, patch: Record<string, unknown>) => {
    setSections((all) => all.map((x) => (x.key === key ? { ...x, data: { ...x.data, ...patch } } : x)));
    touch();
  };
  const setVisible = (key: string, visible: boolean) => {
    setSections((all) => all.map((x) => (x.key === key ? { ...x, visible } : x)));
    touch();
  };
  const hero = sec("hero")?.data ?? {};
  const slides = (Array.isArray(hero.slides) ? hero.slides : []) as Slide[];
  const media = hero.media === "slides" || hero.media === "image" ? "slides" : "video";
  const setSlides = (next: Slide[]) => setData("hero", { slides: next });
  const entrada = sec("entrada")?.data ?? {};
  const novidades = sec("novidades");
  const movable = sections.filter((x) => !FIXED.includes(x.key));
  const intensity = Math.round((typeof hero.parallaxIntensity === "number" ? hero.parallaxIntensity : 0.25) * 200);

  const drop = (to: number) => {
    if (drag === null || drag === to) return;
    const list = [...movable];
    const [m] = list.splice(drag, 1);
    list.splice(to, 0, m);
    setSections([...sections.filter((x) => FIXED.includes(x.key)), ...list]);
    setDrag(null);
    touch();
  };

  const publish = () =>
    start(async () => {
      const a = await publishPageAction(
        "home",
        sections.map((x) => ({ key: x.key, visible: x.visible, data: x.data })),
      );
      if (!a.ok) return setRes(a);
      const h = sec("hero")?.data ?? {};
      const b = await saveHeroAction({
        media: h.media === "slides" ? "slides" : "video",
        slides,
        slidesAuto: h.slidesAuto === true,
        videoDesktop: str(h.videoDesktop),
        videoMobile: str(h.videoMobile),
        poster: str(h.poster),
        posterMobile: str(h.posterMobile),
        image: str(h.image),
        autoplay: h.autoplay !== false,
        loop: h.loop !== false,
        parallax: h.parallax !== false,
        parallaxIntensity: typeof h.parallaxIntensity === "number" ? h.parallaxIntensity : 0.25,
        progress: h.progress !== false,
        reveal: h.reveal !== false,
        scrollbar: h.scrollbar !== false,
      });
      if (!b.ok) return setRes(b);
      const t = await saveTilesAction(tiles);
      if (!t.ok) return setRes(t);
      const e = await saveSeasonsAction(seasons);
      setRes(e.ok ? { ok: true, message: "Alterações publicadas." } : e);
      if (e.ok) setDirty(false);
    });

  const menu = movable.filter((x) => x.visible && INFO[x.key]?.menu && INFO[x.key].menu !== "—").map((x) => (x.key === "colecao" ? (props.collection?.name ?? "Colecção") : INFO[x.key].menu));
  const editSection = editing ? sec(editing) : null;
  const slide = slideSel !== null ? slides[slideSel] : null;
  const tile = tiles[tileSel];

  return (
    <>
      <div className={k.bar}>
        <span>
          {dirty && (
            <span className={c.st} data-tone="warn">
              Alterações por publicar
            </span>
          )}
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.ok ? (res.message ?? "Publicado.") : res.message}
            </span>
          )}
        </span>
        <span className={`${c.row} ${mob.mfix}`}>
          <a href="/pt" target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
            <Icon name="eye" size={15} />
            <span className={mob.dOnly}>Pré-visualizar</span>
            <span className={mob.mOnly}>Ver</span>
          </a>
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending || !dirty} onClick={publish}>
            Publicar alterações
          </button>
        </span>
      </div>

      <div className={`${k.cols} ${k.cols380}`}>
        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Secções da página inicial</h2>
              <a href="#epocas" className={`${c.btn} ${c.xs}`}>
                <Icon name="plus" size={13} />
                Secção sazonal
              </a>
            </div>
            <div className={d3.panelBody}>
              <span className={c.small} style={{ color: "var(--muted)" }}>
                A ordem das secções é a ordem do menu. Ao desligar uma secção, o item sai do menu.
              </span>
              <table className={d3.table}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }} />
                    <th>Secção</th>
                    <th>No menu</th>
                    <th />
                    <th>Visível</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sections
                    .filter((x) => FIXED.includes(x.key))
                    .map((x) => (
                      <tr key={x.key}>
                        <td>
                          <Icon name="lock" size={14} />
                        </td>
                        <td>
                          <b style={{ fontWeight: 500 }}>{INFO[x.key]?.name ?? x.key}</b>
                        </td>
                        <td className={c.small}>{INFO[x.key]?.menu}</td>
                        <td className={c.xsMuted}>{INFO[x.key]?.desc}</td>
                        <td>{x.key === "hero" ? <Toggle on onChange={() => undefined} /> : <Toggle on={x.visible} onChange={(v) => setVisible(x.key, v)} />}</td>
                        <td>
                          {x.key === "hero" ? (
                            <a href="#hero" className={c.textBtn}>
                              Editar
                            </a>
                          ) : (
                            <button type="button" className={c.textBtn} onClick={() => setEditing(x.key)}>
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {movable.map((x, i) => (
                    <tr key={x.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} className={x.key === "colecao" ? c.hl : undefined}>
                      <td>
                        <span style={{ cursor: "grab", color: "var(--muted)", display: "inline-flex" }}>
                          <Icon name="grip" size={18} />
                        </span>
                      </td>
                      <td>
                        <b style={{ fontWeight: 500 }}>{INFO[x.key]?.name ?? x.key}</b>
                      </td>
                      <td className={c.small}>{x.key === "colecao" ? `${props.collection?.name ?? "—"} (automático)` : INFO[x.key]?.menu}</td>
                      <td className={c.xsMuted}>{INFO[x.key]?.desc}</td>
                      <td>
                        <Toggle on={x.visible} onChange={(v) => setVisible(x.key, v)} label={undefined} />
                      </td>
                      <td>
                        <button type="button" className={c.textBtn} onClick={() => setEditing(x.key)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td />
                    <td>
                      <b style={{ fontWeight: 500 }}>Campanha activa · sazonal</b>
                      <br />
                      <span className={c.badge} style={{ marginTop: 4 }}>
                        Sazonal
                      </span>
                    </td>
                    <td className={c.small}>{props.campaign?.name ?? "Nome da campanha"}</td>
                    <td className={c.xsMuted}>Antes ou depois da Colecção (escolhe-se na campanha) · só nas datas</td>
                    <td>
                      <span className={c.st} data-tone={props.campaign ? "ok" : undefined}>
                        {props.campaign ? "A decorrer" : "Sem campanha"}
                      </span>
                    </td>
                    <td>
                      <Link href="/gestao/coleccoes" className={c.textBtn}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className={d3.panel} id="hero">
            <div className={d3.panelHead}>
              <h2>Hero</h2>
            </div>
            <div className={k.body}>
              <div className={c.seg} role="tablist" aria-label="Modo do hero">
                <button type="button" aria-pressed={media === "slides"} onClick={() => setData("hero", { media: "slides" })}>
                  Slides
                </button>
                <button type="button" aria-pressed={media === "video"} onClick={() => setData("hero", { media: "video" })}>
                  Vídeo
                </button>
              </div>
              {media === "slides" ? (
                <>
                  {slides.map((x, i) => (
                    <div key={i} className={c.row} style={{ gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                      <span className={c.row} style={{ gap: 2 }}>
                        <button type="button" className={c.icoBtn} style={{ width: 28, height: 28 }} disabled={i === 0} aria-label="Subir" onClick={() => setSlides(slides.map((s, j) => (j === i - 1 ? slides[i] : j === i ? slides[i - 1] : s)))}>
                          <Icon name="arrowUp" size={14} />
                        </button>
                        <button type="button" className={c.icoBtn} style={{ width: 28, height: 28 }} disabled={i === slides.length - 1} aria-label="Descer" onClick={() => setSlides(slides.map((s, j) => (j === i + 1 ? slides[i] : j === i ? slides[i + 1] : s)))}>
                          <Icon name="arrowDown" size={14} />
                        </button>
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element -- EN: small preview. PT: pré-visualização. */}
                      <img src={x.image} alt="" style={{ width: 112, height: 63, objectFit: "cover", objectPosition: x.position }} />
                      <span className={c.small} style={{ flex: 1 }}>
                        <b style={{ fontWeight: 500 }}>{x.title.pt || "Sem título"}</b>
                        <br />
                        <span className={c.xsMuted}>Ligação: </span>
                        <span className={c.tag} style={{ height: 24, marginTop: 4 }}>
                          <Icon name="arrowRight" size={12} /> {x.href || "—"}
                        </span>
                      </span>
                      <Toggle on={x.on} onChange={(v) => setSlides(slides.map((s, j) => (j === i ? { ...s, on: v } : s)))} label={undefined} />
                      <button type="button" className={c.textBtn} onClick={() => setSlideSel(slideSel === i ? null : i)}>
                        Editar
                      </button>
                    </div>
                  ))}
                  {slide && slideSel !== null && (
                    <div className={k.box}>
                      <MediaField name="Imagem (16:9)" value={slide.image} onChange={(v) => setSlides(slides.map((s, j) => (j === slideSel ? { ...s, image: v } : s)))} />
                      <label className={c.field}>
                        <span className={c.lbl}>Enquadramento</span>
                        <select className={c.select} value={slide.position} onChange={(e) => setSlides(slides.map((s, j) => (j === slideSel ? { ...s, position: e.target.value } : s)))}>
                          {!(slide.position in POSITIONS) && <option value={slide.position}>Personalizado</option>}
                          {Object.entries(POSITIONS).map(([pk, pv]) => (
                            <option key={pk} value={pk}>
                              {pv}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(
                        [
                          ["eyebrow", "Sobretítulo"],
                          ["title", "Título"],
                          ["text", "Frase"],
                          ["cta", "Texto do botão"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className={c.half}>
                          {(["pt", "en"] as const).map((l) => (
                            <label key={l} className={c.field}>
                              <span className={c.lbl}>
                                {label} ({l.toUpperCase()})
                              </span>
                              <input className={c.input} value={slide[key][l]} onChange={(e) => setSlides(slides.map((s, j) => (j === slideSel ? { ...s, [key]: { ...s[key], [l]: e.target.value } } : s)))} />
                            </label>
                          ))}
                        </div>
                      ))}
                      <label className={c.field}>
                        <span className={c.lbl}>Ligação (colecção, categoria, ocasião, produto ou página)</span>
                        <select className={c.select} value={props.targets.some((t) => `category:${t.slug}` === slide.href) ? slide.href : ""} onChange={(e) => e.target.value && setSlides(slides.map((s, j) => (j === slideSel ? { ...s, href: e.target.value } : s)))}>
                          <option value="">Escolher…</option>
                          {props.targets.map((t) => (
                            <option key={t.id} value={`category:${t.slug}`}>
                              {t.kind === "occasion" ? "Ocasião · " : t.kind === "collection" ? "Colecção · " : ""}
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <input className={c.input} value={slide.href} placeholder="category:essenza · product:7g184 · /fidelidade" onChange={(e) => setSlides(slides.map((s, j) => (j === slideSel ? { ...s, href: e.target.value } : s)))} />
                      </label>
                      <button
                        type="button"
                        className={c.textBtn}
                        data-tone="bad"
                        style={{ alignSelf: "flex-start", paddingLeft: 0 }}
                        onClick={() => {
                          if (!window.confirm("Remover este slide?")) return;
                          setSlides(slides.filter((_, j) => j !== slideSel));
                          setSlideSel(null);
                        }}
                      >
                        Remover slide
                      </button>
                    </div>
                  )}
                  <button type="button" className={`${c.btn} ${c.sm}`} style={{ alignSelf: "flex-start" }} disabled={slides.length >= 8} onClick={() => setSlides([...slides, newSlide()])}>
                    <Icon name="plus" size={14} />
                    Adicionar slide
                  </button>
                  <div className={c.note}>
                    <Icon name="info" size={16} />
                    <span className={c.small}>
                      Cada slide: imagem 16:9 · mínimo 2400 × 1350 px (computador) e 4:5 · 1080 × 1350 px (telemóvel) · JPG ou WebP · até 2 MB. Sobretítulo, título, frase, texto do botão e ligação.
                    </span>
                  </div>
                  <Toggle on={hero.slidesAuto === true} onChange={(v) => setData("hero", { slidesAuto: v })} label="Avançar sozinho a cada 7 s (com botão de pausa)" />
                </>
              ) : (
                <>
                  <MediaField name="Vídeo (computador)" value={str(hero.videoDesktop)} onChange={(v) => setData("hero", { videoDesktop: v })} />
                  <div className={c.note}>
                    <Icon name="info" size={16} />
                    <span className={c.small}>Computador: o hero tem a proporção do vídeo (16:9), por isso não corta nem estica. MP4 (H.264) · até 12 MB · toca sem som.</span>
                  </div>
                  <MediaField name="Telemóvel · versão vertical (1080 × 1920, opcional)" value={str(hero.videoMobile)} onChange={(v) => setData("hero", { videoMobile: v })} />
                  <MediaField name="Imagem de capa (enquanto o vídeo carrega)" value={str(hero.poster)} onChange={(v) => setData("hero", { poster: v, posterMobile: v })} />
                  <div className={k.box}>
                    <span className={c.lbl}>Texto sobre o vídeo</span>
                    <div className={c.seg}>
                      <button type="button" aria-pressed={hero.showTitle !== false} onClick={() => setData("hero", { showTitle: true })}>
                        Etiqueta, frase e botão
                      </button>
                      <button type="button" aria-pressed={hero.showTitle === false} onClick={() => setData("hero", { showTitle: false })}>
                        Só etiqueta
                      </button>
                    </div>
                    <span className={c.xsMuted}>Em “Só etiqueta” aparece apenas a cápsula com a etiqueta, sem frase, botão nem sombra.</span>
                    <div className={c.half}>
                      <label className={c.field}>
                        <span className={c.lbl}>Etiqueta</span>
                        <input className={c.input} value={loc(hero.videoBadge).pt} onChange={(e) => setData("hero", { videoBadge: { ...loc(hero.videoBadge), pt: e.target.value } })} />
                      </label>
                      <label className={c.field}>
                        <span className={c.lbl}>Frase</span>
                        <input className={c.input} value={loc(hero.title).pt} onChange={(e) => setData("hero", { title: { ...loc(hero.title), pt: e.target.value } })} />
                      </label>
                      <label className={c.field}>
                        <span className={c.lbl}>Texto do botão</span>
                        <input
                          className={c.input}
                          value={loc((hero.cta as { label?: unknown } | undefined)?.label).pt}
                          onChange={(e) => setData("hero", { cta: { ...(hero.cta as object), label: { ...loc((hero.cta as { label?: unknown } | undefined)?.label), pt: e.target.value } } })}
                        />
                      </label>
                      <label className={c.field}>
                        <span className={c.lbl}>Ligação do botão</span>
                        <select
                          className={c.select}
                          value={str((hero.cta as { href?: unknown } | undefined)?.href)}
                          onChange={(e) => setData("hero", { cta: { ...(hero.cta as object), href: e.target.value } })}
                        >
                          <option value={str((hero.cta as { href?: unknown } | undefined)?.href)}>Colecção activa (automático)</option>
                          {props.targets.map((t) => (
                            <option key={t.id} value={`category:${t.slug}`}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Entrada · frase da página inicial</h2>
            </div>
            <div className={k.body}>
              <label className={c.field}>
                <span className={c.lbl}>Sobretítulo</span>
                <input className={c.input} value={loc(entrada.eyebrow).pt} onChange={(e) => setData("entrada", { eyebrow: { ...loc(entrada.eyebrow), pt: e.target.value } })} />
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Frase</span>
                <input className={c.input} value={loc(entrada.title).pt.replace(/\n/g, " ")} onChange={(e) => setData("entrada", { title: { ...loc(entrada.title), pt: e.target.value } })} />
              </label>
              <span className={c.xsMuted}>As palavras entre *asteriscos* ficam em itálico dourado, como no site.</span>
              <div className={k.box}>
                <span className={c.label}>Mensagem e botão · da colecção activa</span>
                <span className={c.small}>{props.collection?.message ?? "A colecção activa ainda não tem mensagem; aparece a mensagem desta secção."}</span>
                {props.collection && (
                  <>
                    <span className={c.xsMuted}>
                      Botão “{props.collection.buttonText ?? `Descobrir ${props.collection.name}`}” → {props.collection.name}
                    </span>
                    <Link href={`/gestao/coleccoes/${props.collection.id}`} className={`${c.btn} ${c.xs}`} style={{ alignSelf: "flex-start" }}>
                      Editar em Colecções → {props.collection.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Capas e vídeos das secções</h2>
            </div>
            <div className={k.body}>
              {(
                [
                  ["colecao", "Colecção activa · capa", "De ponta a ponta · ao clicar ou descer, sobe e revela Festa / Executiva", props.collection?.imageUrl ?? null, "cover"],
                  ["colecao", "Roupa de Festa e Roupa Executiva · painéis revelados", "Metade do ecrã · mínimo 1600 × 1700 px · etiqueta, frase e dois botões editáveis", null, "cover"],
                  ["noivas", "Eterna Bridal · faixa (vídeo ou foto)", "Faixa 1440 × 520 · só a etiqueta “Eterna Bridal · The White Collection”", str(sec("noivas")?.data.video) || null, "video"],
                  ["acessorios", "Acessórios · de festa / executivos", "Slides Festa e Executivos · trocam sozinhos · mínimo 1600 × 1600 px", null, "cover"],
                  ["modeladores", "Modeladores · imagem", "Faixa simples: texto e uma imagem", str(sec("modeladores")?.data.image) || null, "cover"],
                ] as const
              ).map(([key, title, note, image, kind], i) => (
                <div key={i} className={c.row} style={{ gap: 14, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                  <span className={k.coverCell} style={{ width: 112, height: 63 }}>
                    {image && kind === "video" ? (
                      <video src={image} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- EN: small preview. PT: pré-visualização.
                      <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <Icon name="image" size={18} />
                    )}
                  </span>
                  <span className={c.small} style={{ flex: 1 }}>
                    <b style={{ fontWeight: 500 }}>{title}</b>
                    <br />
                    <span className={c.xsMuted}>{note}</span>
                  </span>
                  {image && <FrameButton url={image} kind={kind} title={title.toLowerCase()} />}
                  {i === 0 && props.collection ? (
                    <Link href={`/gestao/coleccoes/${props.collection.id}`} className={`${c.btn} ${c.xs}`}>
                      Editar capa
                    </Link>
                  ) : (
                    <button type="button" className={`${c.btn} ${c.xs}`} onClick={() => setEditing(key)}>
                      Editar
                    </button>
                  )}
                </div>
              ))}
              <div className={c.note}>
                <Icon name="info" size={16} />
                <span className={c.small}>Vídeos: MP4 (H.264) · 1920 × 1080 · até 12 MB, sem som; o site mostra a imagem de capa enquanto o vídeo carrega.</span>
              </div>
            </div>
          </section>
        </div>

        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Pré-visualização do menu</h2>
            </div>
            <div className={k.body}>
              <div style={{ border: "1px solid var(--line)", background: "var(--surface)", padding: 14, textAlign: "center" }}>
                <span style={{ fontFamily: "var(--font-caps, var(--font-serif))", letterSpacing: "0.3em", fontSize: 18 }}>ETERNA</span>
                <div className={c.row} style={{ justifyContent: "center", gap: 12, marginTop: 10, flexWrap: "wrap", fontSize: 10.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {menu.map((m, i) => (
                    <span key={m} style={i === 0 && sec("colecao")?.visible ? { color: "var(--accent-ink)" } : undefined}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <SeasonsPanel
            seasons={seasons}
            onChange={(next) => {
              setSeasons(next);
              touch();
            }}
          />

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Efeitos de scroll</h2>
            </div>
            <div className={k.body}>
              <Toggle on={hero.parallax !== false} onChange={(v) => setData("hero", { parallax: v })} label="Parallax (capas e vídeos)" />
              <div className={c.row} style={{ gap: 12, paddingLeft: 56 }}>
                <span className={c.xsMuted}>Intensidade</span>
                <input type="range" min={0} max={40} value={Math.min(40, intensity)} onChange={(e) => setData("hero", { parallaxIntensity: Number(e.target.value) / 200 })} style={{ flex: 1, accentColor: "var(--contrast)" }} />
                <span className={c.xsMuted}>{Math.min(40, intensity)}%</span>
              </div>
              <Toggle on={hero.progress !== false} onChange={(v) => setData("hero", { progress: v })} label="Barra de progresso no topo" />
              <Toggle on={hero.reveal !== false} onChange={(v) => setData("hero", { reveal: v })} label="Secções aparecem suavemente" />
              <Toggle on={hero.scrollbar !== false} onChange={(v) => setData("hero", { scrollbar: v })} label="Scrollbar na cor da marca (computador)" />
              <span className={c.xsMuted}>Param sempre que a cliente pede “reduzir movimento”; o parallax fica mais leve em telemóveis fracos.</span>
            </div>
          </section>

          {novidades && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Acabadas de chegar</h2>
              </div>
              <div className={k.body}>
                <Toggle on={novidades.visible} onChange={(v) => setVisible("novidades", v)} label="Mostrar na página inicial" />
                <span className={c.row} style={{ gap: 10 }}>
                  <span className={c.badge}>Automático</span>
                  <span className={c.small}>As últimas peças publicadas, das mais recentes para as mais antigas.</span>
                </span>
                <label className={c.field} style={{ maxWidth: 160 }}>
                  <span className={c.lbl}>Quantas peças</span>
                  <input
                    className={`${c.input} ${c.num}`}
                    inputMode="numeric"
                    value={String(novidades.data.count ?? 8)}
                    onChange={(e) => setData("novidades", { count: Math.min(24, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                  />
                </label>
                <span className={c.xsMuted}>Quando repõem o que foi vendido, as peças novas entram no início. Se não entrar nada, a lista fica como está.</span>
              </div>
            </section>
          )}

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Outras páginas</h2>
            </div>
            <div className={k.body} style={{ gap: 8 }}>
              <Link href="/gestao/conteudo/paginas" className={c.small} style={{ textDecoration: "underline" }}>
                Páginas de informação (tamanhos, trocas, privacidade…)
              </Link>
              <a href="/pt/como-comprar" target="_blank" rel="noopener noreferrer" className={c.small} style={{ textDecoration: "underline" }}>
                Como comprar
              </a>
              <a href="/pt/fidelidade" target="_blank" rel="noopener noreferrer" className={c.small} style={{ textDecoration: "underline" }}>
                Programa de fidelidade
              </a>
              <button type="button" className={c.small} style={{ textDecoration: "underline", border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer" }} onClick={() => setEditing("sobre")}>
                Sobre nós (textos e fotos)
              </button>
            </div>
          </section>
        </div>
      </div>

      {editSection && (
        <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className={c.modal} role="dialog" aria-modal="true" aria-label={INFO[editSection.key]?.name} style={{ width: 860 }}>
            <div className={c.panelH}>
              <h3>{INFO[editSection.key]?.name ?? editSection.key}</h3>
              <button type="button" className={c.icoBtn} onClick={() => setEditing(null)} aria-label="Fechar">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className={c.panelB}>
              {editSection.key === "ocasioes" && (
                <div className={k.box}>
                  <span className={c.label}>Mosaico de ocasiões</span>
                  <div className={c.row} style={{ gap: 8, flexWrap: "wrap" }}>
                    {tiles.map((t, i) => (
                      <button key={t.id ?? i} type="button" className={k.chip} data-on={i === tileSel || undefined} onClick={() => setTileSel(i)}>
                        {t.name.pt || "Nova ocasião"}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={k.chip}
                      onClick={() => {
                        setTiles([...tiles, { name: { pt: "Nova ocasião", en: "New occasion" }, phrase: { pt: "", en: "" }, imageUrl: "/images/v3/s-festa.webp", categoryId: null, size: "normal" }]);
                        setTileSel(tiles.length);
                        touch();
                      }}
                    >
                      <Icon name="plus" size={12} />
                    </button>
                  </div>
                  {tile && (
                    <>
                      <MediaField
                        name="Imagem (vertical 4:5)"
                        value={tile.imageUrl}
                        onChange={(v) => {
                          setTiles(tiles.map((x, j) => (j === tileSel ? { ...x, imageUrl: v } : x)));
                          touch();
                        }}
                      />
                      <div className={c.half}>
                        <label className={c.field}>
                          <span className={c.lbl}>Nome</span>
                          <input
                            className={c.input}
                            value={tile.name.pt}
                            onChange={(e) => {
                              setTiles(tiles.map((x, j) => (j === tileSel ? { ...x, name: { ...x.name, pt: e.target.value } } : x)));
                              touch();
                            }}
                          />
                        </label>
                        <label className={c.field}>
                          <span className={c.lbl}>Frase curta</span>
                          <input
                            className={c.input}
                            maxLength={50}
                            value={tile.phrase.pt}
                            onChange={(e) => {
                              setTiles(tiles.map((x, j) => (j === tileSel ? { ...x, phrase: { ...x.phrase, pt: e.target.value } } : x)));
                              touch();
                            }}
                          />
                        </label>
                        <label className={c.field}>
                          <span className={c.lbl}>Leva a</span>
                          <select
                            className={c.select}
                            value={tile.categoryId ?? ""}
                            onChange={(e) => {
                              setTiles(tiles.map((x, j) => (j === tileSel ? { ...x, categoryId: e.target.value || null } : x)));
                              touch();
                            }}
                          >
                            <option value="">—</option>
                            {props.targets.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={c.field}>
                          <span className={c.lbl}>Tamanho no mosaico</span>
                          <select
                            className={c.select}
                            value={tile.size}
                            onChange={(e) => {
                              setTiles(tiles.map((x, j) => (j === tileSel ? { ...x, size: e.target.value as Tile["size"] } : x)));
                              touch();
                            }}
                          >
                            <option value="large">Grande (2×2)</option>
                            <option value="tall">Alto (1×2)</option>
                            <option value="normal">Normal (1×1)</option>
                          </select>
                        </label>
                      </div>
                      <button
                        type="button"
                        className={c.textBtn}
                        data-tone="bad"
                        style={{ alignSelf: "flex-start", paddingLeft: 0 }}
                        onClick={() => {
                          if (!window.confirm(`Remover a ocasião ${tile.name.pt}?`)) return;
                          setTiles(tiles.filter((_, j) => j !== tileSel));
                          setTileSel(0);
                          touch();
                        }}
                      >
                        Remover ocasião
                      </button>
                    </>
                  )}
                </div>
              )}
              <FieldEditor name="root" value={editSection.data} onChange={(v) => setData(editSection.key, v as Record<string, unknown>)} />
              <span className={c.xsMuted}>Para pôr uma palavra em itálico dourado, escreva-a entre *asteriscos*. Uma linha em branco separa parágrafos. As alterações só aparecem no site depois de “Publicar alterações”.</span>
              <div className={c.end}>
                <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={() => setEditing(null)}>
                  Feito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
