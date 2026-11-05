"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkProductsAction, type ProductActionResult } from "@/app/gestao/actions/products";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";
import m from "./Mobile.module.css";
import d3 from "./Dashboard.module.css";

/**
 * EN: Product table of design V3-G-Produtos with selection and the bulk bar ("Juntar a uma colecção", "Publicar",
 *     "Passar a rascunho").
 * PT: Tabela de produtos do V3 com selecção e a barra de acções em massa.
 */

export interface ProductRowItem {
  id: string;
  code: string;
  type: string;
  group: string;
  collections: string[];
  colors: { key: string; name: string; hex: string | null }[];
  sizes: string;
  stock: number;
  state: "published" | "bridal" | "reserved" | "soldout" | "draft" | "scheduled" | "archived";
  image: string | null;
}

const STATE: Record<ProductRowItem["state"], { label: string; tone?: "ok" | "warn" | "bad"; icon?: "hourglass" | "dress" }> = {
  published: { label: "Publicado", tone: "ok" },
  bridal: { label: "Publicado · prova", tone: "ok", icon: "dress" },
  reserved: { label: "Reservada", tone: "warn", icon: "hourglass" },
  soldout: { label: "Sem stock", tone: "bad" },
  draft: { label: "Rascunho · armazém" },
  scheduled: { label: "Agendado", tone: "warn" },
  archived: { label: "Arquivado" },
};

export function ProductsTable({ items, collections, canPublish, canEdit }: { items: ProductRowItem[]; collections: { id: string; name: string }[]; canPublish: boolean; canEdit: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ProductActionResult | null>(null);
  const [join, setJoin] = useState(false);
  const all = sel.length === items.length && items.length > 0;

  const run = (action: Parameters<typeof bulkProductsAction>[1]) =>
    start(async () => {
      const r = await bulkProductsAction(sel, action);
      setResult(r);
      if (r.ok) {
        setSel([]);
        setJoin(false);
      }
    });

  return (
    <>
      {result?.message && (
        <span role={result.ok ? "status" : "alert"} className={result.ok ? c.ok : c.err}>
          {result.message}
        </span>
      )}
      {canEdit && (
        <div className={c.row} style={{ flexWrap: "wrap", padding: "12px 14px", background: "var(--alt)" }}>
          <span className={c.small}>
            <b style={{ fontWeight: 500 }}>
              {sel.length} {sel.length === 1 ? "seleccionado" : "seleccionados"}
            </b>
          </span>
          {join ? (
            <>
              <select className={c.select} style={{ width: 220 }} defaultValue="" onChange={(e) => e.target.value && run({ kind: "join", collectionId: e.target.value })} disabled={pending}>
                <option value="">Escolha a colecção…</option>
                {collections.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <button type="button" className={c.textBtn} onClick={() => setJoin(false)}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" className={`${c.btn} ${c.xs}`} disabled={!sel.length || pending} onClick={() => setJoin(true)}>
              <Icon name="layers" size={14} />
              Juntar a uma colecção
            </button>
          )}
          {canPublish && (
            <>
              <button type="button" className={`${c.btn} ${c.xs}`} disabled={!sel.length || pending} onClick={() => run({ kind: "publish" })}>
                Publicar
              </button>
              <button type="button" className={`${c.btn} ${c.xs}`} disabled={!sel.length || pending} onClick={() => run({ kind: "draft" })}>
                Passar a rascunho
              </button>
            </>
          )}
          <span className={c.xsMuted} style={{ marginLeft: "auto" }}>
            Publicado = está na loja ou na montra · Rascunho = armazém ou a chegar
          </span>
        </div>
      )}
      <table className={`${d3.table} ${m.prodTable}`}>
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              {canEdit && <input type="checkbox" aria-label="Seleccionar todos" checked={all} onChange={() => setSel(all ? [] : items.map((i) => i.id))} style={{ width: 18, height: 18 }} />}
            </th>
            <th>Peça</th>
            <th>Grupo</th>
            <th>Colecções</th>
            <th>Cores</th>
            <th>Tamanhos</th>
            <th className={d3.right}>Stock</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((p) => {
            const st = STATE[p.state];
            return (
              <tr key={p.id}>
                <td>
                  {canEdit && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${p.code}`}
                      checked={sel.includes(p.id)}
                      onChange={() => setSel((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                      style={{ width: 18, height: 18 }}
                    />
                  )}
                </td>
                <td>
                  <span className={c.row} style={{ gap: 12 }}>
                    {p.image ? <Image src={p.image} alt="" width={40} height={52} style={{ objectFit: "cover", width: 40, height: 52 }} /> : <span style={{ width: 40, height: 52, background: "var(--alt)", display: "inline-block" }} />}
                    <span className={c.who}>
                      <b>{p.code}</b>
                      <span className={c.xsMuted}>{p.type}</span>
                    </span>
                  </span>
                </td>
                <td>{p.group}</td>
                <td>
                  <span className={c.row} style={{ gap: 6, flexWrap: "wrap" }}>
                    {p.collections.map((x) => (
                      <span key={x} className={c.tag}>
                        {x}
                      </span>
                    ))}
                  </span>
                </td>
                <td>
                  <span className={c.row} style={{ gap: 4 }}>
                    {p.colors.slice(0, 6).map((x) => (
                      <span key={x.key} title={x.name} style={{ width: 16, height: 16, borderRadius: 999, background: x.hex ?? "var(--alt)", border: "1px solid var(--line)", display: "inline-block" }} />
                    ))}
                  </span>
                </td>
                <td>
                  <span className={c.small}>{p.sizes}</span>
                </td>
                <td className={d3.right}>
                  <b className={c.num} style={{ fontWeight: 500 }}>
                    {p.stock}
                  </b>
                </td>
                <td>
                  <span className={c.st} data-tone={st.tone}>
                    {st.icon && <Icon name={st.icon} size={13} />}
                    {st.label}
                  </span>
                </td>
                <td>
                  <Link href={`/gestao/produtos/${p.id}`} className={c.textBtn}>
                    Editar
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
