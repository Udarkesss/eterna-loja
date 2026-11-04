"use client";

import { useState } from "react";
import { SEASON_COLORS, seasonDates, type Season, type SeasonColors } from "@/data/seasons";
import { Icon } from "@/components/ui/Icon";
import type { Localized } from "@/types";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";
import { MediaField } from "./FieldEditor";

/**
 * EN: "Épocas do ano" panel of design V3-G-Conteudo: each time of the year with its effect, its place on the home page
 *     and on/off; the selected one shows the text side, the image kind and the colours; texts, images, pieces and dates
 *     open in a window. Saved with the page's "Publicar alterações".
 * PT: Painel "Épocas do ano" do V3: cada época com o efeito, o lugar no Início e ligar/desligar; a escolhida mostra o
 *     lado do texto, o tipo de imagem e as cores; textos, imagens, peças e datas abrem numa janela. Guarda-se com o
 *     "Publicar alterações" da página.
 */

const EFFECTS: Record<Season["effect"], string> = { sparkles: "Brilhos dourados", snow: "Neve", hearts: "Corações", none: "Nenhum" };
const PLACES: Record<Season["placement"], string> = { before: "Antes da colecção", after: "Depois da colecção", none: "Sem secção" };
const SIDES: Record<Season["textSide"], string> = { right: "À direita", left: "À esquerda", top: "Em cima", bottom: "Em baixo" };
const MEDIA: Record<Season["media"], string> = { photo: "Foto", slides: "Slides", video: "Vídeo" };
const COLORS: [keyof SeasonColors, string][] = [
  ["band", "Fundo da faixa"],
  ["desc", "Fundo da descrição"],
  ["title", "Títulos"],
  ["accent", "Destaque"],
  ["text", "Texto"],
  ["button", "Botão"],
  ["buttonText", "Letras do botão"],
];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const L = (pt: string): Localized => ({ pt, en: "" });

const newSeason = (n: number): Season => ({
  id: `epoca-${Date.now().toString(36)}`,
  on: false,
  name: L(`Nova época ${n}`),
  from: "12-01",
  to: "12-15",
  effect: "none",
  placement: "after",
  textSide: "right",
  media: "photo",
  images: ["/images/v3/s-festa.webp"],
  video: "",
  badge: L(""),
  title: L("Nova *época*"),
  text: L(""),
  button: L("Ver as peças"),
  href: "",
  bar: L(""),
  codes: [],
  colors: SEASON_COLORS,
});

function DayMonth({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [m, d] = value.split("-").map(Number);
  const set = (mm: number, dd: number) => onChange(`${String(mm).padStart(2, "0")}-${String(Math.min(31, Math.max(1, dd || 1))).padStart(2, "0")}`);
  return (
    <div className={c.field}>
      <span className={c.lbl}>{label}</span>
      <div className={c.row} style={{ gap: 8 }}>
        <input className={`${c.input} ${c.num}`} style={{ width: 64 }} inputMode="numeric" aria-label={`${label} · dia`} value={String(d)} onChange={(e) => set(m, Number(e.target.value.replace(/\D/g, "")))} />
        <select className={c.select} aria-label={`${label} · mês`} value={m} onChange={(e) => set(Number(e.target.value), d)}>
          {MONTHS.map((x, i) => (
            <option key={x} value={i + 1}>
              {x}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SeasonsPanel({ seasons, onChange }: { seasons: Season[]; onChange: (next: Season[]) => void }) {
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const s = seasons[sel];
  const patch = (i: number, p: Partial<Season>) => onChange(seasons.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const text = (key: "name" | "badge" | "title" | "text" | "button" | "bar", v: string) => s && patch(sel, { [key]: { ...s[key], pt: v } });

  return (
    <section className={d3.panel} id="epocas">
      <div className={d3.panelHead}>
        <h2>Épocas do ano</h2>
      </div>
      <div className={k.body} style={{ gap: 4 }}>
        {seasons.map((x, i) => (
          <div key={x.id} className={c.row} style={{ flexWrap: "wrap", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <button type="button" onClick={() => setSel(i)} className={c.small} style={{ flex: 1, minWidth: 160, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }} aria-pressed={i === sel}>
              <b style={{ fontWeight: 500, textDecoration: i === sel ? "underline" : undefined }}>{x.name.pt}</b>
              <br />
              <span className={c.xsMuted}>
                {seasonDates(x)}
                {x.badge.pt ? ` · ${x.badge.pt.toLowerCase()}` : ""}
              </span>
            </button>
            <select className={`${c.select} ${c.sm}`} style={{ width: "100%" }} aria-label={`Efeito · ${x.name.pt}`} value={x.effect} onChange={(e) => patch(i, { effect: e.target.value as Season["effect"] })}>
              {Object.entries(EFFECTS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <select className={`${c.select} ${c.sm}`} style={{ flex: 1 }} aria-label={`Secção · ${x.name.pt}`} value={x.placement} onChange={(e) => patch(i, { placement: e.target.value as Season["placement"] })}>
              {Object.entries(PLACES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <button type="button" role="switch" aria-checked={x.on} aria-label={`Ligar ${x.name.pt}`} className={c.toggle} onClick={() => patch(i, { on: !x.on })} />
          </div>
        ))}

        {s && (
          <div style={{ paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className={c.small}>
              <b style={{ fontWeight: 500 }}>{s.name.pt}</b> · painel e cores
            </span>
            <div className={c.field}>
              <span className={c.lbl}>Texto do painel</span>
              <div className={c.seg}>
                {Object.entries(SIDES).map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={s.textSide === v} onClick={() => patch(sel, { textSide: v as Season["textSide"] })}>
                    {l}
                  </button>
                ))}
              </div>
              <span className={c.help}>Em cima ou em baixo, a imagem ocupa a largura toda do ecrã.</span>
            </div>
            <div className={c.field}>
              <span className={c.lbl}>Imagem do painel</span>
              <div className={c.seg}>
                {Object.entries(MEDIA).map(([v, l]) => (
                  <button key={v} type="button" aria-pressed={s.media === v} onClick={() => patch(sel, { media: v as Season["media"] })}>
                    {l}
                  </button>
                ))}
              </div>
              <span className={c.help}>Slides: várias fotos que passam sozinhas, com setas. Vídeo: MP4 sem som, com imagem de capa.</span>
            </div>
            <div className={c.field}>
              <span className={c.lbl}>Cores</span>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                {COLORS.map(([key, label]) => (
                  <label key={key} className={c.row} style={{ gap: 8, fontSize: 13 }}>
                    <input type="color" className={k.swatchInput} value={s.colors[key]} onChange={(e) => patch(sel, { colors: { ...s.colors, [key]: e.target.value.toUpperCase() } })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" className={`${c.btn} ${c.sm}`} style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}>
              Textos, imagens, peças e datas
            </button>
          </div>
        )}

        <button
          type="button"
          className={`${c.btn} ${c.sm}`}
          style={{ alignSelf: "flex-start", marginTop: 10 }}
          onClick={() => {
            onChange([...seasons, newSeason(seasons.length + 1)]);
            setSel(seasons.length);
            setOpen(true);
          }}
        >
          <Icon name="plus" size={14} />
          Nova época
        </button>
        <div className={c.note} style={{ marginTop: 10 }}>
          Durante as datas, a barra do topo muda, aparece a secção da época (imagem, texto e peças escolhidas) e o efeito por cima da página. Tudo sai sozinho no fim. O efeito pára para quem pede “reduzir movimento”.
        </div>
      </div>

      {open && s && (
        <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className={c.modal} role="dialog" aria-modal="true" aria-label={s.name.pt} style={{ width: 760 }}>
            <div className={c.panelH}>
              <h3>{s.name.pt}</h3>
              <button type="button" className={c.icoBtn} onClick={() => setOpen(false)} aria-label="Fechar">
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className={c.panelB}>
              <div className={c.three}>
                <label className={c.field}>
                  <span className={c.lbl}>Nome</span>
                  <input className={c.input} value={s.name.pt} onChange={(e) => text("name", e.target.value)} />
                </label>
                <DayMonth label="Começa a" value={s.from} onChange={(v) => patch(sel, { from: v })} />
                <DayMonth label="Termina a" value={s.to} onChange={(v) => patch(sel, { to: v })} />
              </div>
              <span className={c.xsMuted}>Repete-se todos os anos nestas datas.</span>
              <div className={c.half}>
                <label className={c.field}>
                  <span className={c.lbl}>Etiqueta</span>
                  <input className={c.input} value={s.badge.pt} onChange={(e) => text("badge", e.target.value)} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Título</span>
                  <input className={c.input} value={s.title.pt} onChange={(e) => text("title", e.target.value)} />
                </label>
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Texto</span>
                <textarea className={c.input} rows={3} value={s.text.pt} onChange={(e) => text("text", e.target.value)} />
              </label>
              <div className={c.half}>
                <label className={c.field}>
                  <span className={c.lbl}>Botão</span>
                  <input className={c.input} value={s.button.pt} onChange={(e) => text("button", e.target.value)} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>O botão leva a</span>
                  <input className={c.input} placeholder="category:roupa-de-festa" value={s.href} onChange={(e) => patch(sel, { href: e.target.value })} />
                </label>
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Frase da barra do topo</span>
                <input className={c.input} value={s.bar.pt} onChange={(e) => text("bar", e.target.value)} />
                <span className={c.help}>Aparece como “✦ frase · Descobrir ✦”. Vazia: a barra fica como está.</span>
              </label>
              <div className={k.box}>
                <span className={c.label}>{s.media === "slides" ? "Fotos dos slides" : s.media === "video" ? "Imagem de capa do vídeo" : "Foto"}</span>
                {(s.media === "slides" ? s.images : s.images.slice(0, 1)).map((src, i) => (
                  <div key={i} className={c.row} style={{ gap: 8, alignItems: "flex-end" }}>
                    <div style={{ flex: 1 }}>
                      <MediaField name={s.media === "slides" ? `Slide ${i + 1}` : "Imagem"} value={src} onChange={(v) => patch(sel, { images: s.images.map((x, j) => (j === i ? v : x)) })} />
                    </div>
                    {s.media === "slides" && s.images.length > 1 && (
                      <button type="button" className={c.textBtn} data-tone="bad" onClick={() => patch(sel, { images: s.images.filter((_, j) => j !== i) })}>
                        Remover
                      </button>
                    )}
                  </div>
                ))}
                {s.media === "slides" && s.images.length < 8 && (
                  <button type="button" className={`${c.btn} ${c.xs}`} style={{ alignSelf: "flex-start" }} onClick={() => patch(sel, { images: [...s.images, s.images[0] ?? ""] })}>
                    <Icon name="plus" size={13} />
                    Mais uma foto
                  </button>
                )}
                {s.media === "video" && <MediaField name="Vídeo (MP4)" value={s.video} onChange={(v) => patch(sel, { video: v })} />}
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Peças na faixa (códigos)</span>
                <input
                  className={c.input}
                  placeholder="M164, M201, A031, M090"
                  value={s.codes.join(", ")}
                  onChange={(e) =>
                    patch(sel, {
                      codes: e.target.value
                        .split(/[,\s]+/)
                        .map((x) => x.trim().toUpperCase())
                        .filter(Boolean)
                        .slice(0, 8),
                    })
                  }
                />
                <span className={c.help}>Aparecem quatro, as esgotadas saltam-se.</span>
              </label>
              <span className={c.xsMuted}>Para pôr uma palavra em itálico na cor de destaque, escreva-a entre *asteriscos*. As alterações só aparecem no site depois de “Publicar alterações”.</span>
              <div className={c.end} style={{ justifyContent: "space-between" }}>
                <button
                  type="button"
                  className={c.textBtn}
                  data-tone="bad"
                  onClick={() => {
                    if (!window.confirm(`Apagar a época ${s.name.pt}?`)) return;
                    onChange(seasons.filter((_, j) => j !== sel));
                    setSel(0);
                    setOpen(false);
                  }}
                >
                  Apagar época
                </button>
                <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={() => setOpen(false)}>
                  Feito
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
