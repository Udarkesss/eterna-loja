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

const SIZES = { large: "Grande (2×2)", tall: "Alto (1×2)", normal: "Normal (1×1)" } as const;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export function HeroEditor({ hero, tiles: initialTiles, targets }: { hero: Record<string, unknown>; tiles: Tile[]; targets: { id: string; name: string; kind: string }[] }) {
  const [h, setH] = useState({
    media: str(hero.media, "video") as "video" | "image",
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
          <div className={s.segment} role="radiogroup" aria-label="Tipo de media">
            {(["video", "image"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={h.media === m} onClick={() => setHero({ media: m })}>
                {m === "video" ? "Vídeo" : "Imagem"}
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
            <MediaField name="Imagem para computador" value={h.image} onChange={(v) => setHero({ image: v })} />
            <span className={s.hint}>Horizontal 16:9, mínimo 2400 px de largura. O selo e o texto alternativo editam-se em Conteúdo do site → Imagem principal.</span>
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
