"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { bulkProductsAction, type ProductActionResult } from "@/app/gestao/actions/products";
import { Icon } from "@/components/ui/Icon";
import s from "./admin.module.css";

/**
 * EN: Product table with selection and the design's bulk bar (Publicar · Mover para colecção · Marcar em saldo).
 * PT: Tabela de produtos com selecção e a barra de acções em massa do design.
 */

interface Item {
  id: string;
  code: string;
  type: string;
  collection: string;
  occasion: string;
  sizes: string;
  stock: number;
  price: number;
  salePrice: number | null;
  status: "Publicado" | "Rascunho" | "Esgotado" | "Agendado" | "Arquivado";
  image: string | null;
}

const TONE = { Publicado: "ok", Rascunho: "", Esgotado: "bad", Agendado: "warn", Arquivado: "" } as const;
const MARK = { Publicado: "✓", Rascunho: "◷", Esgotado: "!", Agendado: "◷", Arquivado: "–" } as const;
const fmt = (n: number) => `${n.toLocaleString("pt-PT").replace(/ |\./g, " ")},00`;

export function ProductsTable({ items, collections, canPublish, canEdit }: { items: Item[]; collections: { id: string; name: string }[]; canPublish: boolean; canEdit: boolean }) {
  const [sel, setSel] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ProductActionResult | null>(null);
  const [move, setMove] = useState("");
  const all = sel.length === items.length && items.length > 0;

  const run = (action: Parameters<typeof bulkProductsAction>[1]) =>
    start(async () => {
      const r = await bulkProductsAction(sel, action);
      setResult(r);
      if (r.ok) setSel([]);
    });

  return (
    <>
      {result?.message && <div className={result.ok ? s.notice : s.error}>{result.message}</div>}
      {sel.length > 0 && canEdit && (
        <div className={s.card} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", padding: "12px 16px", background: "var(--privee)", color: "var(--on-privee)" }}>
          <span>
            {sel.length} {sel.length === 1 ? "produto seleccionado" : "produtos seleccionados"}
          </span>
          {canPublish && (
            <>
              <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run({ kind: "publish" })}>
                Publicar
              </button>
              <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run({ kind: "draft" })}>
                Passar a rascunho
              </button>
            </>
          )}
          <select className={s.select} style={{ width: "auto", minHeight: 34 }} value={move} onChange={(e) => setMove(e.target.value)} aria-label="Mover para colecção">
            <option value="">Mover para colecção…</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {move && (
            <button className={`${s.btnOutline} ${s.small}`} disabled={pending} onClick={() => run({ kind: "collection", collectionId: move })}>
              Mover
            </button>
          )}
          <button
            className={`${s.btnOutline} ${s.small}`}
            disabled={pending}
            onClick={() => {
              const v = window.prompt("Desconto em % (0 para tirar do saldo):", "20");
              if (v !== null && !Number.isNaN(Number(v))) run({ kind: "sale", percent: Number(v) });
            }}
          >
            Marcar em saldo
          </button>
          <button className={s.linkBtn} style={{ color: "var(--on-privee)", marginLeft: "auto" }} onClick={() => setSel([])} aria-label="Limpar selecção">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
      <section className={s.cardFlush}>
        {items.length === 0 ? (
          <p className={s.empty}>Nenhum produto com estes filtros.</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Seleccionar todos" checked={all} onChange={() => setSel(all ? [] : items.map((i) => i.id))} />
                </th>
                <th>Produto</th>
                <th>Colecção</th>
                <th>Ocasião</th>
                <th>Tamanhos</th>
                <th>Stock</th>
                <th>Preço</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${p.code}`}
                      checked={sel.includes(p.id)}
                      onChange={() => setSel(sel.includes(p.id) ? sel.filter((x) => x !== p.id) : [...sel, p.id])}
                    />
                  </td>
                  <td>
                    <Link href={`/gestao/produtos/${p.id}`} className={s.product}>
                      {p.image ? <Image src={p.image} alt="" width={44} height={55} className={s.thumb} /> : <span className={s.thumb} />}
                      <span className={s.two}>
                        <span className={s.strong}>{p.code}</span>
                        <span className={s.muted}>{p.type}</span>
                      </span>
                    </Link>
                  </td>
                  <td>{p.collection}</td>
                  <td>{p.occasion}</td>
                  <td className={s.muted}>{p.sizes || "—"}</td>
                  <td style={{ color: p.stock === 0 ? "var(--danger)" : p.stock === 1 ? "var(--warning)" : undefined }}>
                    {p.stock === 0 ? "0 · esgotado" : p.stock === 1 ? "1 · última" : p.stock}
                  </td>
                  <td className={s.num}>
                    {p.salePrice ? (
                      <span className={s.two}>
                        <span>{fmt(p.salePrice)} MT</span>
                        <span className={s.muted} style={{ textDecoration: "line-through" }}>
                          {fmt(p.price)} MT
                        </span>
                      </span>
                    ) : (
                      `${fmt(p.price)} MT`
                    )}
                  </td>
                  <td>
                    <span className={s.chip} data-tone={TONE[p.status] || undefined}>
                      {MARK[p.status]} {p.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/gestao/produtos/${p.id}`} className={s.a}>
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className={s.pager}>
          <span>A mostrar {items.length} {items.length === 1 ? "produto" : "produtos"}</span>
        </div>
      </section>
    </>
  );
}
