"use client";

import { useRef, useState, useTransition } from "react";
import { checkImportAction, runImportAction } from "@/app/gestao/actions/importExcel";
import { Icon } from "@/components/ui/Icon";
import type { ImportCheck } from "@/server/import/excel";
import c from "./AdminV3.module.css";
import d3 from "./Dashboard.module.css";

/**
 * EN: "3 · Carregar e verificar" of design V3-G-Importar: the Excel and the ZIP, the summary (rows, new, updates, errors,
 *     warnings), the problems with "aplicar" for each suggestion, and "Importar N produtos" as draft or published.
 * PT: "3 · Carregar e verificar" do V3: o Excel e o ZIP, o resumo, os problemas com "aplicar" para cada sugestão, e
 *     "Importar N produtos" em rascunho ou publicados.
 */

type Fix = { row: number; field: string; value: string };

export function ExcelImport() {
  const excelRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const [excel, setExcel] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [mode, setMode] = useState<"draft" | "publish">("publish");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const form = (extra: Record<string, string> = {}, f: Fix[] = fixes) => {
    const data = new FormData();
    if (excel) data.set("excel", excel);
    if (zip) data.set("zip", zip);
    data.set("fixes", JSON.stringify(f));
    for (const [k, v] of Object.entries(extra)) data.set(k, v);
    return data;
  };
  const verify = (e: File | null, z: File | null, f: Fix[]) => {
    if (!e) return;
    const data = new FormData();
    data.set("excel", e);
    if (z) data.set("zip", z);
    data.set("fixes", JSON.stringify(f));
    start(async () => {
      const r = await checkImportAction(data);
      if (r.ok) {
        setCheck(r.check);
        setMsg(null);
      } else setMsg({ ok: false, text: r.message });
    });
  };

  const drop = (kind: "excel" | "zip") => (ev: React.DragEvent) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files?.[0];
    if (!f) return;
    if (kind === "excel") {
      setExcel(f);
      setFixes([]);
      verify(f, zip, []);
    } else {
      setZip(f);
      verify(excel, f, fixes);
    }
  };

  return (
    <div className={d3.panelBody} style={{ gap: 18 }}>
      <input
        ref={excelRef}
        type="file"
        accept=".xlsx"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          setExcel(f);
          setFixes([]);
          verify(f, zip, []);
        }}
      />
      <input
        ref={zipRef}
        type="file"
        accept=".zip"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          setZip(f);
          verify(excel, f, fixes);
        }}
      />
      <div className={c.half}>
        <button type="button" className={c.dropBox} onClick={() => excelRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={drop("excel")}>
          <Icon name="sheet" size={28} />
          <span style={{ textAlign: "left", flex: 1 }}>
            <b style={{ fontWeight: 500, color: "var(--ink)" }}>{excel?.name ?? "Excel (.xlsx)"}</b>
            <br />
            <span className={c.xsMuted}>{check ? `${check.rows} linhas · ${check.created + check.updated} produtos` : "Arraste o ficheiro ou escolha"}</span>
          </span>
          {excel && check && (
            <span className={c.st} data-tone="ok">
              <Icon name="check" size={13} /> Carregado
            </span>
          )}
        </button>
        <button type="button" className={c.dropBox} onClick={() => zipRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={drop("zip")}>
          <Icon name="zip" size={28} />
          <span style={{ textAlign: "left", flex: 1 }}>
            <b style={{ fontWeight: 500, color: "var(--ink)" }}>{zip?.name ?? "Fotos (.zip)"}</b>
            <br />
            <span className={c.xsMuted}>{check && zip ? `${check.photos} fotos · ${check.folders} pastas` : "Opcional · arraste ou escolha"}</span>
          </span>
          {zip && check && (
            <span className={c.st} data-tone="ok">
              <Icon name="check" size={13} /> Carregado
            </span>
          )}
        </button>
      </div>
      {pending && <span className={c.xsMuted}>A verificar…</span>}
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={msg.ok ? c.ok : c.err}>
          {msg.text}
        </span>
      )}

      {check && (
        <>
          <div className={d3.kpis} style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
            {(
              [
                ["Linhas", check.rows, "", undefined],
                ["Produtos novos", check.created, "", "var(--success)"],
                ["Actualizações", check.updated, "stock e preço", undefined],
                ["Erros", check.errors, "corrigir antes", "var(--danger)"],
                ["Avisos", check.warnings, "sem fotos", "var(--warning)"],
              ] as const
            ).map(([l, v, sub, color]) => (
              <div key={l} className={d3.kpi}>
                <span className={`${d3.kpiLabel} ${d3.muted}`}>{l}</span>
                <b style={color ? { color } : undefined}>{v}</b>
                {sub && <span className={d3.kpiSub}>{sub}</span>}
              </div>
            ))}
          </div>
          {check.issues.length > 0 && (
            <table className={d3.table}>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Código</th>
                  <th>Problema</th>
                  <th>Sugestão</th>
                </tr>
              </thead>
              <tbody>
                {check.issues.slice(0, 200).map((i, n) => (
                  <tr key={n}>
                    <td>{i.row ?? "—"}</td>
                    <td>
                      <b style={{ fontWeight: 500 }}>{i.code}</b>
                    </td>
                    <td>
                      <span className={c.st} data-tone={i.level === "error" ? "bad" : "warn"}>
                        {i.problem}
                      </span>
                    </td>
                    <td>
                      {i.suggestion && i.row !== null ? (
                        <span>
                          Usar <b style={{ fontWeight: 500 }}>{i.suggestion}</b> ·{" "}
                          <button
                            type="button"
                            className={c.textBtn}
                            style={{ padding: 0, height: "auto", textTransform: "none", letterSpacing: 0, fontSize: 14, textDecoration: "underline" }}
                            onClick={() => {
                              const next = [...fixes.filter((f) => !(f.row === i.row && f.field === i.field)), { row: i.row!, field: i.field, value: i.suggestion! }];
                              setFixes(next);
                              verify(excel, zip, next);
                            }}
                          >
                            aplicar
                          </button>
                        </span>
                      ) : (
                        <span className={c.small}>{i.suggestion ?? "Corrija no Excel e carregue de novo"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className={c.row} style={{ gap: 24, paddingTop: 16, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
            <label className={c.check}>
              <input type="radio" name="modo" checked={mode === "draft"} onChange={() => setMode("draft")} /> <span>Importar como rascunho</span>
            </label>
            <label className={c.check}>
              <input type="radio" name="modo" checked={mode === "publish"} onChange={() => setMode("publish")} />{" "}
              <span>
                Importar e publicar <span className={c.xsMuted}>(só os que têm foto)</span>
              </span>
            </label>
            <button
              type="button"
              className={`${c.btnPrimary} ${c.sm}`}
              style={{ marginLeft: "auto" }}
              disabled={pending || check.ready === 0}
              onClick={() =>
                start(async () => {
                  const r = await runImportAction(form({ mode }));
                  setMsg({ ok: r.ok, text: r.message });
                  if (r.ok) setCheck(null);
                })
              }
            >
              Importar {check.ready} {check.ready === 1 ? "produto" : "produtos"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
