"use client";

import { useState, useTransition } from "react";
import { saveMatrixAction, type StaffResult } from "@/app/gestao/actions/staff";
import s from "./admin.module.css";

/**
 * EN: Editable access matrix. The Superadministrador column is locked; changes are checked again on the server.
 * PT: Matriz de acesso editável. A coluna do Superadministrador está bloqueada; o servidor volta a verificar.
 */

const BG: Record<string, string> = { T: "#E3EEE7", L: "#F3ECE6", V: "#F3ECE6", P: "#E9D8CF", Pd: "#F6EBD3", E: "#E9D8CF", "—": "#FFFFFF" };
const SHORT: Record<string, string> = { super: "Superadmin.", admin: "Administrador", gestor: "Gestor de loja", atendedor: "Atendedor", entregador: "Entregador" };

export function RolesMatrix({
  roles,
  rows,
  options,
  editable,
}: {
  roles: { key: string; name: string }[];
  rows: { area: string; label: string; cells: Record<string, string> }[];
  options: Record<string, string>;
  editable: boolean;
}) {
  const [m, setM] = useState(() => Object.fromEntries(rows.map((r) => [r.area, { ...r.cells }])));
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<StaffResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <div className={s.top} style={{ marginTop: -16 }}>
        <div className={s.actions} style={{ fontSize: 12, color: "var(--ink-muted)", gap: 14 }}>
          {Object.entries(options).map(([k, v]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className={s.chip} style={{ background: BG[k], color: "var(--ink)" }}>
                {k}
              </span>
              {v}
            </span>
          ))}
        </div>
        {editable && (
          <div className={s.actions}>
            {dirty && <span className={s.chip} data-tone="warn">Alterações por guardar</span>}
            {result && !dirty && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓ Guardado e registado na auditoria" : result.message}</span>}
            <button
              className={s.btn}
              disabled={pending || !dirty}
              onClick={() =>
                start(async () => {
                  const r = await saveMatrixAction(m);
                  setResult(r);
                  if (r.ok) setDirty(false);
                })
              }
            >
              Guardar permissões
            </button>
          </div>
        )}
      </div>
      <section className={s.cardFlush}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Matriz de acesso</h2>
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Área</th>
              {roles.map((r) => (
                <th key={r.key}>{SHORT[r.key] ?? r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.area}>
                <td>{row.label}</td>
                {roles.map((r) => {
                  const v = m[row.area][r.key];
                  return (
                    <td key={r.key}>
                      <select
                        className={s.select}
                        style={{ minHeight: 34, width: 76, background: BG[v] }}
                        aria-label={`${row.label} · ${r.name}`}
                        value={v}
                        disabled={!editable || r.key === "super"}
                        onChange={(e) => {
                          setM({ ...m, [row.area]: { ...m[row.area], [r.key]: e.target.value } });
                          setDirty(true);
                          setResult(null);
                        }}
                      >
                        {Object.keys(options).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className={s.pager}>A coluna do Superadministrador não pode ser alterada. Os 5 papéis base não se apagam. As permissões são verificadas no servidor em cada pedido.</div>
      </section>
    </>
  );
}
