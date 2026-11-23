"use client";

import { useState, useTransition } from "react";
import { saveFixedCategoriesAction, type ProductActionResult } from "@/app/gestao/actions/products";
import { Icon } from "@/components/ui/Icon";
import c from "./AdminV3.module.css";

/**
 * EN: "Fixas na loja": the groups whose pieces always stay in the shop when the collection changes (e.g. accessories).
 *     Single pieces are fixed from the list ("Fixar na loja").
 * PT: "Fixas na loja": os grupos cujas peças ficam sempre na loja quando muda a colecção (ex.: acessórios). Peças soltas
 *     fixam-se na lista ("Fixar na loja").
 */
export function FixedPiecesForm({ groups, chosen, singles }: { groups: { slug: string; name: string; note?: string }[]; chosen: string[]; singles: number }) {
  const [sel, setSel] = useState(chosen);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ProductActionResult | null>(null);
  const changed = sel.length !== chosen.length || sel.some((s) => !chosen.includes(s));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p className={c.small} style={{ color: "var(--muted)" }}>
        Ao mudar de colecção, as peças destes grupos ficam na loja (não vão para o armazém).
        {singles > 0 && ` Há também ${singles} ${singles === 1 ? "peça fixada" : "peças fixadas"} à mão na lista.`}
      </p>
      <div className={c.row} style={{ flexWrap: "wrap", gap: 8 }}>
        {groups.map((g) => {
          const on = sel.includes(g.slug);
          return (
            <button
              key={g.slug}
              type="button"
              className={c.tag}
              aria-pressed={on}
              onClick={() => setSel((x) => (on ? x.filter((s) => s !== g.slug) : [...x, g.slug]))}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", border: `1px solid ${on ? "var(--ink)" : "var(--line)"}`, background: on ? "var(--ink)" : "transparent", color: on ? "var(--on-contrast)" : "var(--ink)" }}
            >
              {on && <Icon name="lock" size={12} />}
              {g.note ? `${g.name} · ${g.note}` : g.name}
            </button>
          );
        })}
      </div>
      <div className={c.row} style={{ gap: 12 }}>
        <button type="button" className={`${c.btnPrimary} ${c.xs}`} disabled={!changed || pending} onClick={() => start(async () => setRes(await saveFixedCategoriesAction(sel)))}>
          Guardar
        </button>
        {res?.message && (
          <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
            {res.message}
          </span>
        )}
      </div>
    </div>
  );
}
