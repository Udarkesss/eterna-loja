"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { inviteDriverAction, resendInviteAction, setDriverActiveAction } from "@/app/gestao/actions/drivers";
import { Icon } from "@/components/ui/Icon";
import type { DriverRow } from "@/server/admin/drivers";
import c from "./AdminV3.module.css";
import k from "./Collections.module.css";
import d3 from "./Dashboard.module.css";

/**
 * EN: "Entregas · Entregadores" of design V3-G-Entregadores: the delivery team (vehicle, commission, deliveries this
 *     month, state) and "Convidar entregador" (a WhatsApp link valid 48 hours).
 * PT: Entregadores do V3: a equipa de entregas e "Convidar entregador" (link de WhatsApp válido 48 horas).
 */

const VEHICLES = ["Mota", "Carro", "Bicicleta"] as const;
const initials = (n: string) =>
  n
    .replace(/\[|\]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const phoneLabel = (p: string | null) => (p ? `+258 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` : "—");

export function DriversPanel(props: { drivers: DriverRow[]; general: number; stores: { code: string; label: string }[]; canInvite: boolean; delivery: boolean }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message?: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState<(typeof VEHICLES)[number]>("Mota");
  const [plate, setPlate] = useState("");
  const [own, setOwn] = useState(false);
  const [pct, setPct] = useState(String(props.general));
  const [store, setStore] = useState(props.stores[0]?.code ?? "02");

  const open = (url?: string | null) => {
    if (url) window.open(url, "_blank", "noopener");
  };
  const active = props.drivers.filter((d) => d.state === "active").length;
  const waiting = props.drivers.filter((d) => d.state === "invited" || d.state === "expired").length;

  return (
    <div className={k.cols} style={{ gridTemplateColumns: "minmax(0, 1fr) 380px", alignItems: "start" }}>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Equipa de entregas</h2>
          <span className={c.xsMuted}>
            {active} {active === 1 ? "activo" : "activos"}
            {waiting > 0 && ` · ${waiting} por aceitar`}
          </span>
        </div>
        <div className={k.body}>
          {res && (
            <span role={res.ok ? "status" : "alert"} className={res.ok ? c.ok : c.err}>
              {res.message}
            </span>
          )}
          <table className={d3.table}>
            <thead>
              <tr>
                <th>Entregador</th>
                <th>Veículo e comissão</th>
                <th className={d3.right}>Entregas (mês)</th>
                <th>Estado</th>
                <th>Activo</th>
              </tr>
            </thead>
            <tbody>
              {props.drivers.length === 0 && (
                <tr>
                  <td colSpan={5} className={c.small} style={{ color: "var(--muted)" }}>
                    Ainda não há entregadores. Convide o primeiro ao lado.
                  </td>
                </tr>
              )}
              {props.drivers.map((d) => {
                const invited = d.state === "invited" || d.state === "expired";
                return (
                  <tr key={d.id}>
                    <td>
                      <span className={c.row} style={{ gap: 10 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
                          {invited ? "—" : initials(d.name)}
                        </span>
                        <span className={c.small}>
                          <b style={{ fontWeight: 500 }}>{d.name}</b>
                          <br />
                          <span className={c.xsMuted}>{phoneLabel(d.phone)}</span>
                        </span>
                      </span>
                    </td>
                    <td className={c.small}>
                      {[d.vehicle, d.plate].filter(Boolean).join(" · ") || "—"}
                      <br />
                      <span className={c.xsMuted}>{d.commissionPct === null ? `Geral · ${props.general}%` : `Própria · ${d.commissionPct}%`}</span>
                    </td>
                    <td className={d3.right}>
                      <span className={c.num}>{invited ? "—" : d.monthDeliveries}</span>
                    </td>
                    <td>
                      {d.state === "active" && (
                        <span className={c.st} data-tone="ok">
                          Activo
                        </span>
                      )}
                      {d.state === "suspended" && <span className={c.st}>Desactivado</span>}
                      {invited && (
                        <span style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                          <span className={c.st} data-tone="warn">
                            {d.state === "expired" ? "Convite expirado" : "Convite enviado"}
                          </span>
                          {props.canInvite && (
                            <button
                              type="button"
                              className={c.textBtn}
                              style={{ paddingLeft: 0 }}
                              disabled={pending}
                              onClick={() =>
                                start(async () => {
                                  const r = await resendInviteAction(d.id);
                                  setRes(r);
                                  if (r.ok) open(r.whatsappUrl);
                                })
                              }
                            >
                              Reenviar convite
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={d.state !== "suspended"}
                        aria-label={`${d.name} activo`}
                        className={c.toggle}
                        disabled={!props.canInvite || pending}
                        onClick={() => start(async () => setRes(await setDriverActiveAction(d.id, d.state === "suspended")))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!props.delivery && (
            <div className={c.note}>
              <Icon name="info" size={16} />
              <span className={c.small}>
                Com o módulo de entregas desligado em{" "}
                <Link href="/gestao/definicoes" style={{ textDecoration: "underline" }}>
                  Definições
                </Link>
                , os entregadores não conseguem entrar e o checkout mostra só o levantamento na loja. Nada se apaga.
              </span>
            </div>
          )}
        </div>
      </section>

      {props.canInvite && (
        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Convidar entregador</h2>
          </div>
          <form
            className={k.body}
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await inviteDriverAction({ name, phone, vehicle, plate, commissionPct: own ? Number(pct) || 0 : null, storeCode: store });
                setRes(r);
                if (r.ok) {
                  open(r.whatsappUrl);
                  setName("");
                  setPhone("");
                  setPlate("");
                }
              });
            }}
          >
            <label className={c.field}>
              <span className={c.lbl}>Nome</span>
              <input className={c.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className={c.field}>
              <span className={c.lbl}>WhatsApp</span>
              <input className={c.input} inputMode="tel" placeholder="+258 84 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <div className={c.field}>
              <span className={c.lbl}>Veículo</span>
              <div className={c.seg}>
                {VEHICLES.map((v) => (
                  <button key={v} type="button" aria-pressed={vehicle === v} onClick={() => setVehicle(v)}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <label className={c.field}>
              <span className={c.lbl}>Matrícula</span>
              <input className={c.input} value={plate} onChange={(e) => setPlate(e.target.value)} />
            </label>
            <div className={c.field}>
              <span className={c.lbl}>Comissão</span>
              <select className={c.select} value={own ? "own" : "general"} onChange={(e) => setOwn(e.target.value === "own")}>
                <option value="general">Usar o valor geral ({props.general}%)</option>
                <option value="own">Valor próprio…</option>
              </select>
              {own && (
                <span className={c.row} style={{ gap: 8 }}>
                  <input className={`${c.input} ${c.num}`} style={{ width: 90 }} inputMode="numeric" aria-label="Comissão própria" value={pct} onChange={(e) => setPct(e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  <span className={c.xsMuted}>% do preço de cada entrega</span>
                </span>
              )}
            </div>
            <label className={c.field}>
              <span className={c.lbl}>Loja de partida</span>
              <select className={c.select} value={store} onChange={(e) => setStore(e.target.value)}>
                {props.stores.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={`${c.btnPrimary} ${c.full}`} disabled={pending}>
              <Icon name="whatsapp" size={16} />
              Enviar convite por WhatsApp
            </button>
            <span className={c.xsMuted}>O entregador recebe um link válido 48 horas, confirma o número e cria a palavra-passe. Entra só na app do entregador.</span>
          </form>
        </section>
      )}
    </div>
  );
}
