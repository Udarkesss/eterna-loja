"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  importHistoryAction,
  saveCollectionAction,
  setCollectionPiecesAction,
  setCollectionStatusAction,
  uploadCoverAction,
  type CollectionActionResult,
} from "@/app/gestao/actions/collections";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import d3 from "./Dashboard.module.css";
import k from "./Collections.module.css";

/**
 * EN: Interactive parts of "Gestão · Colecções" and "Editar colecção" (design V3).
 * PT: Partes interactivas de Colecções e Editar colecção (V3).
 */

function Feedback({ result }: { result: CollectionActionResult | null }) {
  if (!result) return null;
  return (
    <span role={result.ok ? "status" : "alert"} className={result.ok ? c.ok : c.err}>
      {result.message}
    </span>
  );
}

/** EN: "Activar" / "Desactivar" / "Reactivar" in the list. PT: Na lista. */
export function StatusButton({ id, status, label, confirmText }: { id: string; status: "active" | "archived" | "draft"; label: string; confirmText?: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CollectionActionResult | null>(null);
  return (
    <>
      <button
        type="button"
        className={c.textBtn}
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => setRes(await setCollectionStatusAction(id, status)));
        }}
      >
        {label}
      </button>
      {res && !res.ok && <Feedback result={res} />}
    </>
  );
}

export function ImportHistory() {
  const excel = useRef<HTMLInputElement>(null);
  const zip = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CollectionActionResult | null>(null);
  const [names, setNames] = useState<{ excel?: string; zip?: string }>({});
  return (
    <div className={k.import} id="historico">
      <input ref={excel} type="file" accept=".xlsx" hidden onChange={(e) => setNames((n) => ({ ...n, excel: e.target.files?.[0]?.name }))} />
      <input ref={zip} type="file" accept=".zip" hidden onChange={(e) => setNames((n) => ({ ...n, zip: e.target.files?.[0]?.name }))} />
      <button type="button" className={`${c.btn} ${c.xs}`} onClick={() => excel.current?.click()}>
        <Icon name="sheet" size={13} />
        {names.excel ?? "Escolher Excel"}
      </button>
      <button type="button" className={`${c.btn} ${c.xs}`} onClick={() => zip.current?.click()}>
        <Icon name="zip" size={13} />
        {names.zip ?? "Escolher ZIP das capas"}
      </button>
      <button
        type="button"
        className={`${c.btnPrimary} ${c.xs}`}
        disabled={pending || !names.excel}
        onClick={() => {
          const form = new FormData();
          if (excel.current?.files?.[0]) form.set("excel", excel.current.files[0]);
          if (zip.current?.files?.[0]) form.set("zip", zip.current.files[0]);
          start(async () => setRes(await importHistoryAction(form)));
        }}
      >
        <Icon name="upload" size={13} />
        Importar
      </button>
      <Feedback result={res} />
    </div>
  );
}

type Piece = { id: string; code: string; typeId: string | null; type: string; line: string | null; status: string; inCollection: boolean; image: string | null };

export interface CollectionFormData {
  id?: string;
  slug?: string;
  collectionType: "seasonal" | "special";
  parentId: string | null;
  name: string;
  number: string;
  year: number;
  startsOn: string;
  endsOn: string;
  description: string;
  message: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string | null;
  history: boolean;
  status: "draft" | "active" | "archived";
}

const NUMBERS = ["I", "II", "III", "IV", "V", "VI"];

export function CollectionEditor(props: {
  data: CollectionFormData;
  parents: { id: string; name: string }[];
  pieces: Piece[];
  lines: { slug: string; name: string; types: { id: string; name: string }[] }[];
  activeName: string | null;
  check: { total: number; available: number };
  special: { id: string; name: string; dates: string; imageUrl: string | null }[];
  openConfirm?: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState(props.data);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<CollectionActionResult | null>(null);
  const [line, setLine] = useState(props.lines[0]?.slug ?? "");
  const [type, setType] = useState<string | null>(null);
  const [inSet, setInSet] = useState(() => new Set(props.pieces.filter((p) => p.inCollection).map((p) => p.id)));
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [confirm, setConfirm] = useState(!!props.openConfirm && !!props.data.id && props.data.status !== "active");
  const cover = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<CollectionFormData>) => setD((x) => ({ ...x, ...patch }));
  const original = useMemo(() => new Set(props.pieces.filter((p) => p.inCollection).map((p) => p.id)), [props.pieces]);
  const special = d.collectionType === "special";

  const save = () =>
    start(async () => {
      const r = await saveCollectionAction({
        id: d.id,
        collectionType: d.collectionType,
        parentId: special ? d.parentId : null,
        name: d.name,
        number: d.number,
        year: Number(d.year) || 0,
        startsOn: d.startsOn || null,
        endsOn: d.endsOn || null,
        description: d.description,
        message: d.message,
        buttonText: d.buttonText,
        buttonLink: d.buttonLink,
        imageUrl: d.imageUrl,
        history: d.history,
      });
      if (r.ok && r.id) {
        const add = [...inSet].filter((x) => !original.has(x));
        const remove = [...original].filter((x) => !inSet.has(x));
        if (add.length || remove.length) {
          const p = await setCollectionPiecesAction(r.id, add, remove);
          if (!p.ok) return setRes(p);
        }
        if (!d.id) router.replace(`/gestao/coleccoes/${r.id}`);
        else router.refresh();
      }
      setRes(r);
    });

  const linePieces = props.pieces.filter((p) => inSet.has(p.id) && (special || p.line === line) && (!type || p.typeId === type));
  const candidates = props.pieces.filter((p) => !inSet.has(p.id) && (!query || p.code.toLowerCase().includes(query.toLowerCase())));
  const lineTypes = props.lines.find((l) => l.slug === line)?.types ?? [];
  const counts = Object.fromEntries(props.lines.map((l) => [l.slug, props.pieces.filter((p) => inSet.has(p.id) && p.line === l.slug).length]));

  return (
    <>
      <div className={k.bar}>
        <span>
          <Feedback result={res} />
        </span>
        <span className={c.row}>
          {d.id && d.slug && !d.history && (
            <a href={`/pt/category/${props.data.slug ?? ""}`} target="_blank" rel="noopener noreferrer" className={`${c.btn} ${c.sm}`}>
              <Icon name="eye" size={15} />
              Pré-visualizar
            </a>
          )}
          <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending} onClick={save}>
            Guardar
          </button>
        </span>
      </div>
      <div className={k.cols}>
        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Informação</h2>
            </div>
            <div className={k.body}>
              {!d.history && (
                <div className={c.seg} role="group" aria-label="Tipo">
                  <button type="button" aria-pressed={!special} onClick={() => set({ collectionType: "seasonal" })}>
                    Colecção sazonal
                  </button>
                  <button type="button" aria-pressed={special} onClick={() => set({ collectionType: "special", parentId: d.parentId ?? props.parents[0]?.id ?? null })}>
                    Edição especial
                  </button>
                  <Link href="/gestao/campanhas/nova">Campanha de preços</Link>
                </div>
              )}
              <div className={k.three}>
                <label className={c.field}>
                  <span className={c.lbl}>Nome</span>
                  <input className={c.input} value={d.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Número</span>
                  <select className={c.select} value={d.number} onChange={(e) => set({ number: e.target.value })}>
                    <option value="">—</option>
                    {NUMBERS.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Ano</span>
                  <input className={`${c.input} ${c.num}`} inputMode="numeric" value={d.year || ""} onChange={(e) => set({ year: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </label>
              </div>
              {special && (
                <label className={c.field}>
                  <span className={c.lbl}>Dentro da colecção</span>
                  <select className={c.select} value={d.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })}>
                    {props.parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className={c.half}>
                <label className={c.field}>
                  <span className={c.lbl}>Início planeado</span>
                  <input type="date" className={`${c.input} ${c.num}`} value={d.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
                </label>
                <label className={c.field}>
                  <span className={c.lbl}>Fim planeado</span>
                  <input type="date" className={`${c.input} ${c.num}`} value={d.endsOn} onChange={(e) => set({ endsOn: e.target.value })} />
                </label>
              </div>
              {!d.history && (
                <>
                  <label className={c.field}>
                    <span className={c.lbl}>Texto curto</span>
                    <textarea className={`${c.input} ${k.area}`} value={d.description} onChange={(e) => set({ description: e.target.value })} />
                  </label>
                  {!special && (
                    <div className={k.box}>
                      <span className={c.label}>Na página inicial · entrada</span>
                      <label className={c.field}>
                        <span className={c.lbl}>Mensagem</span>
                        <textarea className={`${c.input} ${k.area}`} style={{ minHeight: 84 }} value={d.message} onChange={(e) => set({ message: e.target.value })} />
                      </label>
                      <div className={c.half}>
                        <label className={c.field}>
                          <span className={c.lbl}>Texto do botão</span>
                          <input className={c.input} value={d.buttonText} placeholder={`Descobrir ${d.name}`} onChange={(e) => set({ buttonText: e.target.value })} />
                        </label>
                        <label className={c.field}>
                          <span className={c.lbl}>Ligação do botão</span>
                          <select
                            className={c.select}
                            value={d.buttonLink === "auto" || !d.buttonLink ? "auto" : "custom"}
                            onChange={(e) => set({ buttonLink: e.target.value === "auto" ? "auto" : d.buttonLink === "auto" ? "category:" : d.buttonLink })}
                          >
                            <option value="auto">Esta colecção (automático)</option>
                            <option value="custom">Categoria, peça ou endereço…</option>
                          </select>
                          {d.buttonLink !== "auto" && d.buttonLink !== "" && (
                            <input className={c.input} value={d.buttonLink} placeholder="category:gala · product:8g1l7 · https://…" onChange={(e) => set({ buttonLink: e.target.value })} />
                          )}
                        </label>
                      </div>
                      <span className={c.xsMuted}>Aparece na entrada da página inicial enquanto esta colecção estiver activa; ao activar outra, entra a mensagem dela. Entre *asteriscos* fica em destaque.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Capas</h2>
            </div>
            <div className={k.body}>
              <input
                ref={cover}
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
                    const r = await uploadCoverAction(form);
                    if (r.ok && r.url) set({ imageUrl: r.url });
                    else setRes(r);
                  });
                }}
              />
              <div className={c.field} style={{ maxWidth: 640 }}>
                <span className={c.lbl}>{d.history ? "Capa · 3:4" : "Capa horizontal · 16:9"}</span>
                <button type="button" className={d.history ? k.coverTall : k.cover} onClick={() => cover.current?.click()}>
                  {d.imageUrl ? (
                    <Image src={d.imageUrl} alt="" fill sizes="640px" style={{ objectFit: "cover", objectPosition: "center 40%" }} />
                  ) : (
                    <>
                      <Icon name="image" size={26} />
                      <span className={c.xsMuted}>Arraste a imagem ou escolha um ficheiro</span>
                    </>
                  )}
                </button>
                <div className={c.note}>
                  <Icon name="info" size={16} />
                  <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
                    {d.history ? "Capa do arquivo: 3:4 · JPG ou WebP · até 2 MB." : "Banner da página inicial e topo da página da colecção: 16:9 · mínimo 2400 × 1350 px · JPG ou WebP · até 2 MB."}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {!d.history && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Peças da colecção</h2>
              </div>
              <div className={k.body}>
                {!special && (
                  <nav className={d3.tabs} aria-label="Linhas">
                    {props.lines.map((l) => (
                      <a
                        key={l.slug}
                        href="#"
                        aria-current={l.slug === line ? "page" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          setLine(l.slug);
                          setType(null);
                        }}
                      >
                        {l.name} <span className={d3.count}>{counts[l.slug] ?? 0}</span>
                      </a>
                    ))}
                  </nav>
                )}
                {!special && (
                  <div className={k.chips}>
                    <button type="button" className={k.chip} data-on={!type || undefined} onClick={() => setType(null)}>
                      Todos
                    </button>
                    {lineTypes.map((t) => (
                      <button key={t.id} type="button" className={k.chip} data-on={type === t.id || undefined} onClick={() => setType(t.id)}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className={k.grid}>
                  {linePieces.slice(0, 60).map((p) => (
                    <div key={p.id} className={k.piece}>
                      <div className={k.photo}>
                        {p.image && <Image src={p.image} alt="" fill sizes="140px" style={{ objectFit: "cover" }} />}
                        {p.status !== "Publicada" && <span className={k.badge}>{p.status === "Armazém" ? "Rascunho" : "Indisponível"}</span>}
                        <button type="button" className={k.remove} aria-label={`Tirar ${p.code}`} onClick={() => setInSet((s) => new Set([...s].filter((x) => x !== p.id)))}>
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                      <span className={c.xsMuted} style={{ color: "var(--ink)" }}>
                        <b style={{ fontWeight: 500 }}>{p.code}</b> · {p.status}
                      </span>
                    </div>
                  ))}
                </div>
                {linePieces.length > 60 && <span className={c.xsMuted}>A mostrar 60 de {linePieces.length}.</span>}
                {adding ? (
                  <div className={k.adder}>
                    <label className={d3.search}>
                      <Icon name="search" size={16} />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código da peça" aria-label="Procurar peça" autoFocus />
                    </label>
                    <div className={k.candidates}>
                      {candidates.slice(0, 30).map((p) => (
                        <button key={p.id} type="button" onClick={() => setInSet((s) => new Set([...s, p.id]))}>
                          <Icon name="plus" size={12} /> {p.code} <span className={c.xsMuted}>{p.type}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className={c.textBtn} onClick={() => setAdding(false)} style={{ alignSelf: "flex-start", paddingLeft: 0 }}>
                      Fechar
                    </button>
                  </div>
                ) : (
                  <button type="button" className={`${c.btn} ${c.sm}`} style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}>
                    <Icon name="plus" size={14} />
                    Adicionar peças
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <div className={k.stack}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>Estado</h2>
            </div>
            <div className={k.body}>
              <span className={c.st} data-tone={d.status === "active" ? "ok" : undefined} style={{ alignSelf: "flex-start" }}>
                {d.status === "active" ? "Activa" : d.status === "archived" ? (d.history ? "Arquivada · histórico" : "Arquivada") : "Rascunho"}
              </span>
              {!d.history && d.id && !special && <span className={c.small} style={{ color: "var(--muted)" }}>{props.activeName ? `Colecção activa agora: ${props.activeName}.` : "Nenhuma colecção activa."}</span>}
              {d.id && !d.history && d.status !== "active" && (
                <button type="button" className={`${c.btnPrimary} ${c.sm} ${c.full}`} onClick={() => setConfirm(true)}>
                  Activar {special ? "edição" : "colecção"}
                </button>
              )}
              {d.id && !d.history && d.status === "active" && (
                <button
                  type="button"
                  className={`${c.btn} ${c.sm} ${c.full}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await setCollectionStatusAction(d.id!, "archived");
                      setRes(r);
                      if (r.ok) set({ status: "archived" });
                    })
                  }
                >
                  Desactivar
                </button>
              )}
              {!d.id && <span className={c.xsMuted}>Guarde primeiro para poder activar.</span>}
            </div>
          </section>

          {props.special.length > 0 && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>Edição especial ligada</h2>
              </div>
              <div className={k.body}>
                {props.special.map((s) => (
                  <a key={s.id} href={`/gestao/coleccoes/${s.id}`} className={c.row} style={{ gap: 12 }}>
                    <span className={k.thumb}>{s.imageUrl && <Image src={s.imageUrl} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />}</span>
                    <span className={c.small}>
                      <b style={{ fontWeight: 500 }}>{s.name}</b>
                      <br />
                      <span style={{ color: "var(--muted)" }}>{s.dates}</span>
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {!d.history && !special && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>No site</h2>
              </div>
              <div className={k.body} style={{ gap: 8 }}>
                {[`Menu: “${d.name}”`, `Botão do hero: “Comprar ${d.name}”`, "Secção Colecção na página inicial", "Entrada: mensagem e botão desta colecção", "Selo “Novo” ao entrar na colecção"].map((x) => (
                  <span key={x} className={c.row} style={{ gap: 8, fontSize: 14 }}>
                    <Icon name="check" size={14} />
                    {x}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {confirm && d.id && (
        <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && setConfirm(false)}>
          <div className={c.modal} role="dialog" aria-modal="true" aria-label={`Activar ${d.name}`} style={{ width: 600 }}>
            <div className={c.panelH}>
              <h3>Activar a {d.name}?</h3>
            </div>
            <div className={c.panelB}>
              <p className={c.small}>
                {special || !props.activeName ? (
                  <>
                    A <b>{d.name}</b> passa a aparecer no site.
                  </>
                ) : (
                  <>
                    Activar a <b>{d.name}</b> vai substituir a <b>{props.activeName}</b> no site, no menu e no botão da página inicial (“Comprar {d.name}”).
                  </>
                )}
              </p>
              <div className={c.kv}>
                <span>Peças disponíveis</span>
                <b className={c.num}>
                  {props.check.available} de {props.check.total}
                </b>
              </div>
              <div className={c.kv}>
                <span>Indisponíveis (vendidas, sem stock ou em rascunho)</span>
                <b className={c.num} style={{ color: "var(--warning)" }}>
                  {props.check.total - props.check.available}
                </b>
              </div>
              {props.activeName && !special && <span className={c.xsMuted}>A {props.activeName} fica arquivada, com as ligações às peças guardadas.</span>}
              <div className={c.end}>
                <button type="button" className={`${c.btn} ${c.sm}`} onClick={() => setConfirm(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`${c.btnPrimary} ${c.sm}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await setCollectionStatusAction(d.id!, "active");
                      setRes(r);
                      if (r.ok) {
                        set({ status: "active" });
                        setConfirm(false);
                        router.refresh();
                      }
                    })
                  }
                >
                  Activar {d.name}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
