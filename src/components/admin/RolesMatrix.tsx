"use client";

import { useState, useTransition } from "react";
import { saveMatrixAction, type StaffResult } from "@/app/gestao/actions/staff";
import s from "./admin.module.css";
import mob from "./Mobile.module.css";

/**
 * EN: Editable access matrix. The Superadministrador column is locked; changes are checked again on the server.
 * PT: Matriz de acesso editável. A coluna do Superadministrador está bloqueada; o servidor volta a verificar.
 */

const BG: Record<string, string> = { T: "#E3EEE7", L: "#F3ECE6", V: "#F3ECE6", P: "#E9D8CF", Pd: "#F6EBD3", E: "#E9D8CF", "—": "#FFFFFF" };
const SUB: Record<string, string> = {
  super: "Tudo, incluindo chaves e definições",
  admin: "Loja inteira, sem chaves nem papéis",
  gestor: "Só a(s) sua(s) loja(s)",
  atendedor: "Atendimento do dia a dia",
  entregador: "Só as próprias entregas",
};
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
  // EN: Phone (V3-M-G-Papeis): one role at a time. PT: Telemóvel: um papel de cada vez.
  const [role, setRole] = useState(roles.find((r) => r.key === "gestor")?.key ?? roles[0]?.key);
  const change = (area: string, key: string, value: string) => {
    setM({ ...m, [area]: { ...m[area], [key]: value } });
    setDirty(true);
    setResult(null);
  };

  return (
    <>
      <div className={s.top} style={{ marginTop: -16 }}>
        <div className={`${s.actions} ${mob.dOnly}`} style={{ fontSize: 12, color: "var(--ink-muted)", gap: 14 }}>
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
      <section className={`${s.cardFlush} ${mob.mOnly}`} style={{ flexDirection: "column" }}>
        <div role="tablist" aria-label="Papel" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          {roles.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === role}
              className={s.chip}
              style={{ whiteSpace: "nowrap", cursor: "pointer", border: "1px solid var(--line)", background: r.key === role ? "var(--ink)" : "transparent", color: r.key === role ? "var(--surface)" : "var(--ink)" }}
              onClick={() => setRole(r.key)}
            >
              {SHORT[r.key] ?? r.name}
            </button>
          ))}
        </div>
        <div style={{ padding: "14px 16px 4px", display: "flex", flexDirection: "column" }}>
          <b style={{ fontWeight: 500 }}>{roles.find((r) => r.key === role)?.name}</b>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{SUB[role] ?? ""}</span>
        </div>
        {rows.map((row) => {
          const v = m[row.area][role];
          return (
            <label key={row.area} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderTop: "1px solid var(--line)", fontSize: 14 }}>
              <span>{row.label}</span>
              <select
                className={s.select}
                style={{ minHeight: 36, maxWidth: 170, background: BG[v] }}
                value={v}
                disabled={!editable || role === "super"}
                onChange={(e) => change(row.area, role, e.target.value)}
              >
                {Object.entries(options).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <div className={s.pager}>A coluna do Superadministrador não pode ser alterada. Os 5 papéis base não se apagam. As permissões são verificadas no servidor em cada pedido.</div>
      </section>
      <section className={`${s.cardFlush} ${mob.dOnly}`}>
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
                        onChange={(e) => change(row.area, r.key, e.target.value)}
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
