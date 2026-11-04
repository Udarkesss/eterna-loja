"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { findPiecesAction, saveCategorySettingsAction } from "@/app/gestao/actions/categories";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";

/**
 * EN: Order and filters of one category (design V3-G-Categorias): default order, featured pieces (drag to order) and the
 *     filters shown on its page.
 * PT: Ordem e filtros de uma categoria (V3): ordem por defeito, peças em destaque (arrastar para ordenar) e os filtros.
 */

type Piece = { id: string; code: string; image: string | null };
type Filters = { size: boolean; color: boolean; price: boolean; types: boolean; reserved: boolean };
const SORTS = [
  ["featured", "Em destaque (ordem manual)"],
  ["newest", "Mais recentes"],
  ["bestsellers", "Mais vendidos"],
  ["price_asc", "Preço: mais baixo"],
  ["price_desc", "Preço: mais alto"],
  ["name", "Nome A–Z"],
  ["size", "Tamanho"],
  ["type", "Tipo de peça"],
] as const;
const FILTERS: [keyof Filters, string, string?][] = [
  ["size", "Tamanho", "Sempre visível"],
  ["color", "Cor"],
  ["price", "Preço"],
  ["types", "Tipo de peça (barra com imagens)"],
  ["reserved", "Mostrar peças reservadas"],
];

export function CategorySettingsForm(props: { slug: string; name: string; sort: string; featured: Piece[]; filters: Filters; siteHref: string }) {
  const [sort, setSort] = useState(props.sort);
  const [featured, setFeatured] = useState(props.featured);
  const [filters, setFilters] = useState(props.filters);
  const [drag, setDrag] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Piece[]>([]);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);

  const save = () =>
    start(async () =>
      setRes(
        await saveCategorySettingsAction(props.slug, {
          sort: sort as (typeof SORTS)[number][0],
          featured: featured.map((f) => f.id),
          filters,
        }),
      ),
    );
  const drop = (to: number) => {
    if (drag === null || drag === to) return;
    const next = [...featured];
    const [m] = next.splice(drag, 1);
    next.splice(to, 0, m);
    setFeatured(next);
    setDrag(null);
  };

  return (
    <div className={k.stack}>
      <div className={k.bar} style={{ marginTop: 0 }}>
        <span>
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.message}
            </span>
          )}
        </span>
        <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending} onClick={save}>
          Guardar
        </button>
      </div>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>{props.name} · ordem</h2>
          <a href={props.siteHref} target="_blank" rel="noopener noreferrer" className={d3.ulink}>
            Ver no site
          </a>
        </div>
        <div className={k.body}>
          <label className={c.field}>
            <span className={c.lbl}>Ordem por defeito</span>
            <select className={c.select} style={{ maxWidth: 360 }} value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <span className={c.label}>Em destaque · arraste para ordenar</span>
          <div className={c.row} style={{ gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
            {featured.map((p, i) => (
              <div key={p.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)} className={k.piece} style={{ width: 84, cursor: "grab" }}>
                <div className={k.photo} style={{ height: 112 }}>
                  {p.image && <Image src={p.image} alt="" fill sizes="84px" style={{ objectFit: "cover" }} />}
                  <span className={k.badge}>{i + 1}</span>
                  <button type="button" className={k.remove} aria-label={`Tirar ${p.code}`} onClick={() => setFeatured((f) => f.filter((x) => x.id !== p.id))}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
                <span className={c.xsMuted} style={{ color: "var(--ink)", textAlign: "center" }}>
                  {p.code}
                </span>
              </div>
            ))}
            <button type="button" className={k.cover} style={{ width: 84, height: 112, aspectRatio: "auto" }} aria-label="Juntar peça em destaque" onClick={() => setAdding(!adding)}>
              <Icon name="plus" size={18} />
            </button>
          </div>
          {adding && (
            <div className={k.adder}>
              <label className={d3.search}>
                <Icon name="search" size={16} />
                <input
                  value={query}
                  autoFocus
                  placeholder="Código da peça"
                  aria-label="Código da peça"
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuery(v);
                    start(async () => setHits(await findPiecesAction(v)));
                  }}
                />
              </label>
              <div className={k.candidates}>
                {hits
                  .filter((h) => !featured.some((f) => f.id === h.id))
                  .map((h) => (
                    <button key={h.id} type="button" onClick={() => setFeatured((f) => [...f, h])}>
                      <Icon name="plus" size={12} /> {h.code}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </section>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>{props.name} · filtros</h2>
        </div>
        <table className={d3.table}>
          <thead>
            <tr>
              <th>Filtro</th>
              <th>Visível</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {FILTERS.map(([key, label, note]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={key === "size" ? true : filters[key]}
                    aria-label={label}
                    className={c.toggle}
                    disabled={key === "size"}
                    onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                  />
                </td>
                <td>{note && <span className={c.xsMuted}>{note}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Aparência</h2>
        </div>
        <div className={k.body}>
          <span className={c.label}>Formato das imagens da barra de tipos</span>
          <div className={c.seg}>
            <button type="button" aria-pressed="true">
              Círculo, centrado
            </button>
          </div>
          <span className={c.xsMuted}>Igual em todo o site. Cada imagem enquadra-se no círculo em Tipos de peça.</span>
        </div>
      </section>
    </div>
  );
}
