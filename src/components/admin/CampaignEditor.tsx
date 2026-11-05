"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  piecesByCodesAction,
  piecesFromExcelAction,
  piecesOfGroupAction,
  saveCampaignAction,
  setCampaignStateAction,
  uploadCampaignImageAction,
  type CampaignActionResult,
} from "@/app/gestao/actions/campaigns";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";
import { FrameButton } from "./FrameDialog";

/**
 * EN: "Gestão · Nova campanha" of design V3-G-Campanha-Editar. PT: Nova campanha do V3.
 */

type Piece = { id: string; code: string; price: number; image: string | null; percent: number | null };
type Opt = { id: string; name: string };
type Colors = { band: string; desc: string; title: string; accent: string; text: string; button: string; buttonText: string };

export interface CampaignFormData {
  id?: string;
  slug?: string;
  name: string;
  phrase: string;
  kind: "normal" | "flash";
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  discountMode: "uniform" | "per_piece";
  percent: number;
  topBar: boolean;
  homePlacement: "before" | "after" | "none";
  ownPage: boolean;
  countdown: boolean;
  colors: Colors;
  imageUrl: string | null;
  state: "draft" | "scheduled" | "running" | "ended";
}

const COLOR_LABELS: [keyof Colors, string][] = [
  ["band", "Fundo da faixa"],
  ["desc", "Fundo da descrição"],
  ["title", "Títulos"],
  ["accent", "Destaque"],
  ["text", "Texto"],
  ["button", "Botão"],
  ["buttonText", "Texto do botão"],
];
const round50 = (v: number) => Math.round(v / 50) * 50;
const mt = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")},00 MT`;

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={c.toggleRow} style={disabled ? { color: "var(--muted)" } : undefined}>
      <button type="button" role="switch" aria-checked={on} className={c.toggle} disabled={disabled} onClick={() => onChange?.(!on)} />
      <span>{label}</span>
    </label>
  );
}

export function CampaignEditor(props: { data: CampaignFormData; pieces: Piece[]; groups: { collections: Opt[]; occasions: Opt[]; departments: Opt[]; types: Opt[] } }) {
  const router = useRouter();
  const [d, setD] = useState(props.data);
  const [pieces, setPieces] = useState(props.pieces);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CampaignActionResult | null>(null);
  const [picker, setPicker] = useState<null | "collection" | "occasion" | "type" | "codes">(null);
  const [codes, setCodes] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const image = useRef<HTMLInputElement>(null);
  const excel = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<CampaignFormData>) => setD((x) => ({ ...x, ...patch }));

  const addPieces = (list: Piece[]) => {
    setPieces((cur) => {
      const have = new Set(cur.map((p) => p.id));
      const fresh = list.filter((p) => !have.has(p.id));
      setNote(`${fresh.length} ${fresh.length === 1 ? "peça juntada" : "peças juntadas"}.`);
      return [...cur, ...fresh];
    });
    setPicker(null);
  };
  const fromGroup = (id: string) => id && start(async () => addPieces(await piecesOfGroupAction(id)));

  const save = (then?: "schedule" | "start") =>
    start(async () => {
      const r = await saveCampaignAction({
        id: d.id,
        name: d.name,
        phrase: d.phrase,
        kind: d.kind,
        startsAt: `${d.startDate}T${d.startTime || "00:00"}`,
        endsAt: `${d.endDate}T${d.endTime || "23:59"}`,
        discountMode: d.discountMode,
        percent: d.percent,
        topBar: d.topBar,
        homePlacement: d.homePlacement,
        ownPage: d.ownPage,
        countdown: d.countdown,
        colors: d.colors,
        imageUrl: d.imageUrl,
        items: pieces.map((p) => ({ productId: p.id, percent: d.discountMode === "per_piece" ? (p.percent ?? d.percent) : null })),
      });
      if (!r.ok) return setRes(r);
      if (then && r.id) {
        const s = await setCampaignStateAction(r.id, then);
        setRes(s);
        if (s.ok) set({ state: then === "start" ? "running" : "scheduled" });
      } else setRes(r);
      if (!d.id && r.id) router.replace(`/gestao/campanhas/${r.id}`);
      else router.refresh();
    });
  const state = (action: "end" | "draft") =>
    start(async () => {
      const r = await setCampaignStateAction(d.id!, action);
      setRes(r);
      if (r.ok) set({ state: action === "end" ? "ended" : "draft" });
      router.refresh();
    });

  const STATE = { draft: ["Rascunho", undefined], scheduled: ["Agendada", "warn"], running: ["A decorrer", "ok"], ended: ["Terminada", undefined] } as const;
  const [label, tone] = STATE[d.state];
  const when = (date: string, time: string) => (date ? `${Number(date.slice(8))}/${date.slice(5, 7)} às ${time || "00:00"}` : "—");

  return (
    <>
      <div className={k.bar}>
        <span>
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.message}
            </span>
          )}
        </span>
        <span className={c.row}>
          {d.slug && d.state === "running" && d.ownPage && (
            <a href={`/pt/campanha/${d.slug}`} target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
              <Icon name="eye" size={15} />
              Pré-visualizar
            </a>
          )}
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending} onClick={() => save()}>
            Guardar
          </button>
        </span>
      </div>
      <div className={k.cols}>
        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Campanha</h2>
            </div>
            <div className={k.body}>
              <div className={c.seg} role="group" aria-label="Tipo de campanha">
                <button type="button" aria-pressed={d.kind === "normal"} onClick={() => set({ kind: "normal" })}>
                  Campanha
                </button>
                <button type="button" aria-pressed={d.kind === "flash"} onClick={() => set({ kind: "flash", endDate: d.startDate, startTime: d.startTime === "00:00" ? "14:00" : d.startTime, endTime: "20:00" })}>
                  Relâmpago (horas)
                </button>
              </div>
              <label className={c.field}>
                <span className={c.lbl}>Nome da campanha</span>
                <input className={c.input} value={d.name} onChange={(e) => set({ name: e.target.value })} />
                <span className={c.help}>Qualquer nome: Saldos de Verão, Dia da Mulher, Aniversário Eterna…</span>
              </label>
              <div className={k.dates}>
                <label className={c.field}>
                  <span className={c.lbl}>Começa</span>
                  <input type="date" className={`${c.input} ${c.num}`} value={d.startDate} onChange={(e) => set({ startDate: e.target.value, ...(d.kind === "flash" ? { endDate: e.target.value } : {}) })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Hora</span>
                  <input type="time" className={`${c.input} ${c.num}`} value={d.startTime} onChange={(e) => set({ startTime: e.target.value })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Termina</span>
                  <input type="date" className={`${c.input} ${c.num}`} value={d.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Hora</span>
                  <input type="time" className={`${c.input} ${c.num}`} value={d.endTime} onChange={(e) => set({ endTime: e.target.value })} />
                </label>
              </div>
              <span className={c.xsMuted}>Relâmpago: escolhe-se o dia e as horas (ex.: hoje, das 14:00 às 20:00) e a contagem decrescente fica em destaque.</span>
              <label className={c.field}>
                <span className={c.lbl}>Frase</span>
                <input className={c.input} value={d.phrase} placeholder="Até −30% em peças seleccionadas. Enquanto houver stock." onChange={(e) => set({ phrase: e.target.value })} />
              </label>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Desconto e peças</h2>
            </div>
            <div className={k.body}>
              <div className={c.seg} role="group" aria-label="Desconto">
                <button type="button" aria-pressed={d.discountMode === "uniform"} onClick={() => set({ discountMode: "uniform" })}>
                  Igual para todas
                </button>
                <button type="button" aria-pressed={d.discountMode === "per_piece"} onClick={() => set({ discountMode: "per_piece" })}>
                  Por peça
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,160px) minmax(0,1fr)", gap: 12, alignItems: "end" }}>
                <label className={c.field}>
                  <span className={c.lbl}>Desconto</span>
                  <input className={`${c.input} ${c.num}`} inputMode="numeric" value={`${d.percent} %`} onChange={(e) => set({ percent: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
                </label>
                <span className={c.xsMuted}>Com o desconto do nível de fidelidade, aplica-se o maior dos dois.</span>
              </div>
              <div className={c.field}>
                <span className={c.lbl}>Escolher as peças · qualquer peça publicada</span>
                <div className={k.chips}>
                  <button type="button" className={k.chip} data-on={picker === "collection" || undefined} onClick={() => setPicker(picker === "collection" ? null : "collection")}>
                    Colecção
                  </button>
                  <button type="button" className={k.chip} data-on={picker === "occasion" || undefined} onClick={() => setPicker(picker === "occasion" ? null : "occasion")}>
                    Ocasiões
                  </button>
                  {props.groups.departments.map((g) => (
                    <button key={g.id} type="button" className={k.chip} disabled={pending} onClick={() => fromGroup(g.id)}>
                      {g.name}
                    </button>
                  ))}
                  <button type="button" className={k.chip} data-on={picker === "type" || undefined} onClick={() => setPicker(picker === "type" ? null : "type")}>
                    Tipo de peça
                  </button>
                  <button type="button" className={k.chip} data-on={picker === "codes" || undefined} onClick={() => setPicker(picker === "codes" ? null : "codes")}>
                    Peça a peça
                  </button>
                  <button type="button" className={k.chip} onClick={() => excel.current?.click()}>
                    Importar Excel
                  </button>
                  <input
                    ref={excel}
                    type="file"
                    accept=".xlsx"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      const form = new FormData();
                      form.set("file", f);
                      start(async () => {
                        const r = await piecesFromExcelAction(form);
                        if ("error" in r) setNote(r.error);
                        else {
                          addPieces(r.pieces);
                          if (r.missing.length) setNote(`Sem stock ou não encontradas: ${r.missing.slice(0, 10).join(", ")}`);
                        }
                      });
                    }}
                  />
                </div>
                {picker && picker !== "codes" && (
                  <select className={c.select} style={{ maxWidth: 320 }} defaultValue="" onChange={(e) => fromGroup(e.target.value)} disabled={pending}>
                    <option value="">Escolha…</option>
                    {(picker === "collection" ? props.groups.collections : picker === "occasion" ? props.groups.occasions : props.groups.types).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
                {picker === "codes" && (
                  <span className={c.row} style={{ gap: 8 }}>
                    <input className={c.input} value={codes} onChange={(e) => setCodes(e.target.value)} placeholder="Códigos separados por espaços: 8G125 8G159 …" />
                    <button
                      type="button"
                      className={`${c.btn} ${c.sm}`}
                      disabled={pending || !codes.trim()}
                      onClick={() =>
                        start(async () => {
                          const r = await piecesByCodesAction(codes);
                          addPieces(r.pieces);
                          if (r.missing.length) setNote(`Sem stock ou não encontradas: ${r.missing.slice(0, 10).join(", ")}`);
                          setCodes("");
                        })
                      }
                    >
                      Juntar
                    </button>
                  </span>
                )}
                <span className={c.help}>Pode juntar peças de várias categorias na mesma campanha. Só entram peças publicadas e com stock.</span>
                {note && <span className={c.xsMuted}>{note}</span>}
              </div>
              <div className={k.grid}>
                {pieces.slice(0, 120).map((p, i) => {
                  const pct = d.discountMode === "per_piece" ? (p.percent ?? d.percent) : d.percent;
                  return (
                    <div key={p.id} className={k.piece}>
                      <div className={k.photo}>
                        {p.image && <Image src={p.image} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />}
                        <span className={k.badge} style={{ background: "var(--danger)" }}>
                          −{pct}%
                        </span>
                        <button type="button" className={k.remove} aria-label={`Tirar ${p.code}`} onClick={() => setPieces((cur) => cur.filter((x) => x.id !== p.id))}>
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                      <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
                        <b style={{ fontWeight: 500 }}>{p.code}</b>
                      </span>
                      <span className={c.xsMuted} style={{ textDecoration: "line-through" }}>
                        {mt(p.price)}
                      </span>
                      <span className={c.xsMuted} style={{ color: "var(--danger)" }}>
                        {mt(round50((p.price * (100 - pct)) / 100))}
                      </span>
                      {d.discountMode === "per_piece" && (
                        <input
                          className={`${c.input} ${c.num}`}
                          style={{ height: 32 }}
                          aria-label={`Desconto de ${p.code}`}
                          value={`${pct} %`}
                          onChange={(e) => setPieces((cur) => cur.map((x, j) => (j === i ? { ...x, percent: Math.min(90, Number(e.target.value.replace(/\D/g, "")) || 0) || null } : x)))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <span className={c.xsMuted}>
                {pieces.length} {pieces.length === 1 ? "peça escolhida" : "peças escolhidas"}
                {pieces.length > 120 ? " · a mostrar 120" : ""}
              </span>
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Onde aparece</h2>
            </div>
            <div className={k.body}>
              <Toggle on={d.topBar} onChange={(v) => set({ topBar: v })} label="Barra do topo, com o nome e a frase" />
              <div className={c.field}>
                <span className={c.lbl}>Secção na página inicial</span>
                <div className={c.seg} role="group" aria-label="Secção na página inicial">
                  {(
                    [
                      ["before", "Antes da colecção"],
                      ["after", "Depois da colecção"],
                      ["none", "Não mostrar"],
                    ] as const
                  ).map(([v, l]) => (
                    <button key={v} type="button" aria-pressed={d.homePlacement === v} onClick={() => set({ homePlacement: v })}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <Toggle on={d.ownPage} onChange={(v) => set({ ownPage: v })} label="Página própria da campanha" />
              <Toggle on={d.countdown} onChange={(v) => set({ countdown: v })} label="Contagem decrescente" />
              <div className={c.field}>
                <span className={c.lbl}>Cores</span>
                <div className={k.colors}>
                  {COLOR_LABELS.map(([key, l]) => (
                    <label key={key} className={c.row} style={{ gap: 8, fontSize: 13 }}>
                      <input type="color" value={d.colors[key]} onChange={(e) => set({ colors: { ...d.colors, [key]: e.target.value } })} className={k.swatchInput} aria-label={l} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <Toggle on label="Selo −% e preço nos cartões de todo o site (colecções, ocasiões, pesquisa, favoritos) · sempre ligado" disabled />
              <input
                ref={image}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const form = new FormData();
                  form.set("file", f);
                  start(async () => {
                    const r = await uploadCampaignImageAction(form);
                    if (r.ok && r.url) set({ imageUrl: r.url });
                    else setRes(r);
                  });
                }}
              />
              <div className={c.row} style={{ gap: 14 }}>
                <span className={k.coverCell} style={{ width: 112, height: 63 }}>
                  {d.imageUrl ? <Image src={d.imageUrl} alt="" fill sizes="112px" style={{ objectFit: "cover" }} /> : <Icon name="image" size={18} />}
                </span>
                <span className={c.small} style={{ flex: 1 }}>
                  <b style={{ fontWeight: 500 }}>Imagem da campanha</b>
                  <br />
                  <span className={c.xsMuted}>16:9 · mínimo 2400 × 1350 px</span>
                </span>
                {d.imageUrl && <FrameButton url={d.imageUrl} kind="cover" title="imagem da campanha" />}
                <button type="button" className={`${c.btn} ${c.xs}`} onClick={() => image.current?.click()}>
                  <Icon name="upload" size={13} />
                  {d.imageUrl ? "Trocar" : "Carregar"}
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Estado</h2>
            </div>
            <div className={k.body}>
              <span className={c.st} data-tone={tone} style={{ alignSelf: "flex-start" }}>
                {label}
              </span>
              <span className={c.small} style={{ color: "var(--muted)" }}>
                {d.state === "ended"
                  ? "Terminou. As peças voltaram ao preço normal."
                  : `Começa sozinha a ${when(d.startDate, d.startTime)} e termina a ${when(d.endDate, d.endTime)}. No fim, as peças voltam ao preço normal.`}
              </span>
              {(d.state === "draft" || d.state === "ended") && (
                <button type="button" className={`${c.btnPrimary} ${c.sm} ${c.full}`} disabled={pending} onClick={() => save("schedule")}>
                  Agendar campanha
                </button>
              )}
              {d.state !== "running" && (
                <button type="button" className={`${c.btn} ${c.sm} ${c.full}`} disabled={pending} onClick={() => save("start")}>
                  Começar agora
                </button>
              )}
              {d.state === "running" && (
                <button type="button" className={`${c.btn} ${c.sm} ${c.full}`} disabled={pending} onClick={() => window.confirm("Terminar a campanha agora? As peças voltam ao preço normal.") && state("end")}>
                  Terminar agora
                </button>
              )}
              {d.state === "scheduled" && (
                <button type="button" className={c.textBtn} style={{ alignSelf: "flex-start", paddingLeft: 0 }} disabled={pending} onClick={() => state("draft")}>
                  Passar a rascunho
                </button>
              )}
            </div>
          </section>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>No site</h2>
            </div>
            <div className={k.body} style={{ gap: 8 }}>
              {(
                [
                  ["Página inicial com a campanha", "/pt"],
                  ["Página da campanha", d.slug ? `/pt/campanha/${d.slug}` : null],
                  ["Colecção com as peças em campanha", "/pt#colecao"],
                ] as const
              ).map(([l, href]) =>
                href && d.state === "running" ? (
                  <a key={l} href={href} target="_blank" rel="noopener noreferrer" className={c.row} style={{ gap: 8, fontSize: 14, color: "var(--accent-ink)" }}>
                    <Icon name="eye" size={14} />
                    {l}
                  </a>
                ) : (
                  <span key={l} className={c.row} style={{ gap: 8, fontSize: 14, color: "var(--muted)" }}>
                    <Icon name="eye" size={14} />
                    {l}
                  </span>
                ),
              )}
              {d.state !== "running" && <span className={c.xsMuted}>As ligações abrem enquanto a campanha estiver a decorrer.</span>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
