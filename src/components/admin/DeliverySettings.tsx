"use client";

import { useState, useTransition } from "react";
import { markPaidAction, saveCommissionsAction, savePricingAction, type DeliveryResult } from "@/app/gestao/actions/delivery";
import type { DeliveryPricing } from "@/lib/delivery";
import s from "./admin.module.css";

/**
 * EN: "Preço da entrega" (fixed / by zone / by distance), "Comissão do entregador" and the earnings table.
 * PT: "Preço da entrega" (fixo / por zona / por distância), "Comissão do entregador" e a tabela de ganhos.
 */

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\D/g, "")));
const str = (v: number | null) => (v == null ? "" : String(v));

function Feedback({ r }: { r: DeliveryResult | null }) {
  return r?.message ? <div className={r.ok ? s.notice : s.error}>{r.message}</div> : null;
}

export function DeliverySettings(props: {
  pricing: DeliveryPricing;
  zones: { id: string; name: string; fee: number | null; eta: string }[];
  editPricing: boolean;
  showPricing: boolean;
  commissions: { general: number; drivers: { id: string; name: string; pct: number | null }[] };
  editCommissions: boolean;
  showCommissions: boolean;
}) {
  const [pending, start] = useTransition();
  const [p, setP] = useState(props.pricing);
  const [zones, setZones] = useState(props.zones);
  const [general, setGeneral] = useState(String(props.commissions.general));
  const [drivers, setDrivers] = useState(props.commissions.drivers);
  const [r1, setR1] = useState<DeliveryResult | null>(null);
  const [r2, setR2] = useState<DeliveryResult | null>(null);
  const ro = !props.editPricing;

  return (
    <div className={s.split2}>
      {props.showPricing && (
        <section className={s.card}>
          <h2 className={s.h2}>Preço da entrega</h2>
          <Feedback r={r1} />
          <div className={s.segment} role="radiogroup" aria-label="Forma de cálculo" style={{ alignSelf: "flex-start" }}>
            {(
              [
                ["fixed", "Valor fixo"],
                ["zone", "Por zona"],
                ["distance", "Por distância"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={p.mode === id} disabled={ro} onClick={() => setP({ ...p, mode: id })}>
                {label}
              </button>
            ))}
          </div>
          {p.mode === "fixed" && (
            <label className={s.label}>
              Valor fixo por entrega (MT)
              <input className={s.input} inputMode="numeric" placeholder="[valor]" value={str(p.fixedFee)} readOnly={ro} onChange={(e) => setP({ ...p, fixedFee: num(e.target.value) })} />
              <span className={s.hint}>Igual para qualquer morada.</span>
            </label>
          )}
          {p.mode === "zone" && (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Zona / bairro</th>
                  <th>Preço (MT)</th>
                  <th>Prazo</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z, i) => (
                  <tr key={z.id}>
                    <td>{z.name}</td>
                    <td style={{ width: 140 }}>
                      <input
                        className={s.input}
                        inputMode="numeric"
                        placeholder="[valor]"
                        aria-label={`Preço ${z.name}`}
                        value={str(z.fee)}
                        readOnly={ro}
                        onChange={(e) => setZones(zones.map((x, j) => (j === i ? { ...x, fee: num(e.target.value) } : x)))}
                      />
                    </td>
                    <td className={s.muted}>{z.eta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {p.mode === "distance" && (
            <>
              <div className={s.row3}>
                <label className={s.label}>
                  Valor base (MT)
                  <input className={s.input} inputMode="numeric" placeholder="[valor]" value={str(p.baseFee)} readOnly={ro} onChange={(e) => setP({ ...p, baseFee: num(e.target.value) })} />
                </label>
                <label className={s.label}>
                  Por km (MT)
                  <input className={s.input} inputMode="numeric" placeholder="[valor]" value={str(p.perKm)} readOnly={ro} onChange={(e) => setP({ ...p, perKm: num(e.target.value) })} />
                </label>
                <label className={s.label}>
                  Máximo (MT)
                  <input className={s.input} inputMode="numeric" placeholder="Sem máximo" value={str(p.maxFee)} readOnly={ro} onChange={(e) => setP({ ...p, maxFee: num(e.target.value) })} />
                </label>
              </div>
              <span className={s.hint}>A distância é calculada a partir do Glória Mall até ao pino que a cliente marca no mapa.</span>
            </>
          )}
          <span className={s.hint}>Enquanto um valor estiver vazio, o checkout mostra “[valor]” e a entrega não é cobrada.</span>
          {props.editPricing && (
            <button
              className={s.btn}
              style={{ alignSelf: "flex-start" }}
              disabled={pending}
              onClick={() => start(async () => setR1(await savePricingAction(p, zones.map((z) => ({ id: z.id, fee: z.fee })))))}
            >
              Guardar preços
            </button>
          )}
        </section>
      )}

      {props.showCommissions && (
        <section className={s.card}>
          <h2 className={s.h2}>Comissão do entregador</h2>
          <Feedback r={r2} />
          <label className={s.label}>
            Percentagem geral
            <span style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "none", letterSpacing: 0, fontWeight: 300 }}>
              <input className={s.input} style={{ width: 90 }} inputMode="numeric" value={general} readOnly={!props.editCommissions} onChange={(e) => setGeneral(e.target.value.replace(/\D/g, "").slice(0, 3))} />% do preço da entrega
            </span>
            <span className={s.hint}>Valor usado para todos os entregadores sem valor próprio.</span>
          </label>
          {drivers.length > 0 && (
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Entregador</th>
                  <th>Regra</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((d, i) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>
                      <select
                        className={s.select}
                        style={{ minHeight: 36 }}
                        disabled={!props.editCommissions}
                        value={d.pct == null ? "general" : "own"}
                        aria-label={`Comissão de ${d.name}`}
                        onChange={(e) => setDrivers(drivers.map((x, j) => (j === i ? { ...x, pct: e.target.value === "general" ? null : Number(general) || 0 } : x)))}
                      >
                        <option value="general">Usa o valor geral</option>
                        <option value="own">Valor próprio</option>
                      </select>
                    </td>
                    <td style={{ width: 90 }}>
                      <input
                        className={s.input}
                        style={{ minHeight: 36 }}
                        inputMode="numeric"
                        aria-label={`Percentagem de ${d.name}`}
                        value={d.pct == null ? "" : String(d.pct)}
                        placeholder={general}
                        readOnly={!props.editCommissions || d.pct == null}
                        onChange={(e) => setDrivers(drivers.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0 } : x)))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {props.editCommissions && (
            <button
              className={s.btn}
              style={{ alignSelf: "flex-start" }}
              disabled={pending}
              onClick={() => start(async () => setR2(await saveCommissionsAction(Number(general) || 0, drivers.map((d) => ({ id: d.id, pct: d.pct })))))}
            >
              Guardar comissões
            </button>
          )}
        </section>
      )}
    </div>
  );
}

export function EarningsTable({
  rows,
  period,
  canPay,
}: {
  rows: { id: string; name: string; count: number; valueLabel: string; pct: number; amountLabel: string; paid: boolean }[];
  period: "week" | "month" | "lastMonth";
  canPay: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<DeliveryResult | null>(null);
  return (
    <>
      {result?.message && <div className={result.ok ? s.notice : s.error} style={{ margin: 16 }}>{result.message}</div>}
      <table className={s.table}>
        <thead>
          <tr>
            <th>Entregador</th>
            <th>Entregas</th>
            <th>Valor das entregas</th>
            <th>Comissão</th>
            <th>A pagar</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.count}</td>
              <td className={s.num}>{r.valueLabel}</td>
              <td>{r.pct} %</td>
              <td className={`${s.num} ${s.strong}`}>{r.amountLabel}</td>
              <td>
                <span className={s.chip} data-tone={r.paid ? "ok" : "warn"}>
                  {r.paid ? "✓ Pago" : "◷ Pendente"}
                </span>
              </td>
              <td>
                {!r.paid && canPay && (
                  <button
                    className={`${s.btnOutline} ${s.small}`}
                    disabled={pending}
                    onClick={() => window.confirm(`Marcar a comissão de ${r.name} como paga?`) && start(async () => setResult(await markPaidAction(r.id, period)))}
                  >
                    Marcar como pago
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
