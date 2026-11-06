"use client";

import { useState, useTransition } from "react";
import { saveBridalSettingsAction, type FittingActionResult } from "@/app/gestao/actions/fittings";
import { Icon } from "@/components/ui/Icon";
import type { BridalPackage, BridalSettings } from "@/data/bridal";
import s from "./admin.module.css";
import d3 from "./Dashboard.module.css";
import b from "./BridalSettings.module.css";

/**
 * EN: "Provas ligadas" switch and "Pacotes de prova" / "Regras e agenda" of design V3. What is saved here is what the
 *     site shows and charges (packages, extra dresses, days, start times, rules, terms PDF).
 * PT: Interruptor "Provas ligadas" e "Pacotes de prova" / "Regras e agenda" do V3. O que se guarda aqui é o que o site
 *     mostra e cobra (pacotes, vestidos extra, dias, horas, regras).
 */

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const STATUS: Record<BridalPackage["status"], string> = { active: "Activo", soon: "Brevemente", off: "Desligado" };

export function BridalToggle({ settings, summary, canEdit }: { settings: BridalSettings; summary: string; canEdit: boolean }) {
  const [on, setOn] = useState(settings.enabled);
  const [pending, start] = useTransition();
  return (
    <div className={b.toggleRow}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={s.switch}
        disabled={!canEdit || pending}
        onClick={() =>
          start(async () => {
            const r = await saveBridalSettingsAction({ ...settings, enabled: !on });
            if (r.ok) setOn(!on);
            else window.alert(r.message);
          })
        }
      />
      <span className={b.toggleLabel}>Provas ligadas</span>
      <span className={d3.muted}>· {on ? summary : "O site não deixa marcar provas"}</span>
      <a href="#pacotes" className={d3.ulink} style={{ marginLeft: "auto" }}>
        Pacotes e regras
      </a>
    </div>
  );
}

export function BridalSettingsEditor({ settings, canEdit }: { settings: BridalSettings; canEdit: boolean }) {
  const [v, setV] = useState(settings);
  const [newHour, setNewHour] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FittingActionResult | null>(null);
  const set = (patch: Partial<BridalSettings>) => {
    setV({ ...v, ...patch });
    setResult(null);
  };
  const setPkg = (i: number, patch: Partial<BridalPackage>) => set({ packages: v.packages.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const num = (value: string) => Math.max(0, Math.round(Number(value.replace(/\s/g, "").replace(",", ".")) || 0));
  const dirty = JSON.stringify(v) !== JSON.stringify(settings);

  return (
    <div id="pacotes" className={b.layout}>
      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Pacotes de prova</h2>
        </div>
        <table className={d3.table}>
          <thead>
            <tr>
              <th>Pacote</th>
              <th className={d3.right}>Vestidos</th>
              <th>Duração</th>
              <th className={d3.right}>Valor (MT)</th>
              <th>Inclui</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {v.packages.map((p, i) => (
              <tr key={p.key}>
                <td>
                  <input className={`${s.input} ${b.name}`} value={p.name} disabled={!canEdit} onChange={(e) => setPkg(i, { name: e.target.value })} aria-label="Nome do pacote" />
                </td>
                <td className={d3.right}>
                  <input className={`${s.input} ${b.small}`} inputMode="numeric" value={p.dresses} disabled={!canEdit} onChange={(e) => setPkg(i, { dresses: num(e.target.value) })} aria-label={`Vestidos · ${p.name}`} />
                </td>
                <td>
                  <select className={s.select} value={p.minutes} disabled={!canEdit} onChange={(e) => setPkg(i, { minutes: Number(e.target.value) })} aria-label={`Duração · ${p.name}`}>
                    {[30, 60, 90, 120, 150, 180, 240].map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} min` : `${m / 60} ${m === 60 ? "hora" : "horas"}`.replace(".5", ",5")}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={d3.right}>
                  <input className={`${s.input} ${b.price}`} inputMode="numeric" value={p.price} disabled={!canEdit} onChange={(e) => setPkg(i, { price: num(e.target.value) })} aria-label={`Valor · ${p.name}`} />
                </td>
                <td>
                  <textarea
                    className={`${s.textarea} ${b.includes}`}
                    rows={2}
                    value={p.includes.pt}
                    disabled={!canEdit}
                    onChange={(e) => setPkg(i, { includes: { ...p.includes, pt: e.target.value } })}
                    aria-label={`Inclui · ${p.name}`}
                  />
                </td>
                <td>
                  <select className={s.select} value={p.status} disabled={!canEdit} onChange={(e) => setPkg(i, { status: e.target.value as BridalPackage["status"] })} aria-label={`Estado · ${p.name}`}>
                    {Object.entries(STATUS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className={d3.panelBody}>
          {canEdit && v.packages.length < 6 && (
            <button
              type="button"
              className={`${s.btnOutline} ${s.small}`}
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                set({
                  packages: [
                    ...v.packages,
                    { key: `pacote-${v.packages.length + 1}`, name: "Novo pacote", dresses: 3, minutes: 60, price: 0, includes: { pt: "", en: "" }, status: "off" },
                  ],
                })
              }
            >
              <Icon name="plus" size={14} />
              Novo pacote
            </button>
          )}
          <div className={s.row3}>
            <label className={s.label}>
              Vestidos extra · máximo
              <input className={s.input} inputMode="numeric" value={v.extraMax} disabled={!canEdit} onChange={(e) => set({ extraMax: num(e.target.value) })} />
            </label>
            <label className={s.label}>
              Preço por vestido extra (MT)
              <input className={s.input} inputMode="numeric" value={v.extraPrice} disabled={!canEdit} onChange={(e) => set({ extraPrice: num(e.target.value) })} />
            </label>
            <label className={s.label}>
              Desconta no vestido até (dias)
              <input className={s.input} inputMode="numeric" value={v.discountDays} disabled={!canEdit} onChange={(e) => set({ discountDays: num(e.target.value) })} />
            </label>
          </div>
          <span className={s.hint}>“Brevemente” mostra o pacote no site sem deixar marcar. Os valores e o texto “Inclui” aparecem no site e no Como comprar.</span>
        </div>
      </section>

      <section className={d3.panel}>
        <div className={d3.panelHead}>
          <h2>Regras e agenda</h2>
        </div>
        <div className={d3.panelBody}>
          <span className={s.legend}>Dias de prova</span>
          <div className={b.chips}>
            {WEEKDAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                className={b.chip}
                aria-pressed={v.days.includes(i + 1)}
                disabled={!canEdit}
                onClick={() => set({ days: v.days.includes(i + 1) ? v.days.filter((x) => x !== i + 1) : [...v.days, i + 1].sort() })}
              >
                {d}
              </button>
            ))}
          </div>
          <span className={s.legend}>Horas de início</span>
          <div className={b.chips}>
            {v.hours.map((h) => (
              <button
                key={h}
                type="button"
                className={b.chip}
                aria-pressed="true"
                disabled={!canEdit}
                title="Tirar esta hora"
                onClick={() => v.hours.length > 1 && set({ hours: v.hours.filter((x) => x !== h) })}
              >
                {h}
              </button>
            ))}
            {canEdit && (
              <span className={b.addHour}>
                <input type="time" step={1800} value={newHour} onChange={(e) => setNewHour(e.target.value)} aria-label="Nova hora" />
                <button
                  type="button"
                  className={b.chip}
                  onClick={() => {
                    if (/^\d{2}:\d{2}$/.test(newHour) && !v.hours.includes(newHour)) set({ hours: [...v.hours, newHour].sort() });
                    setNewHour("");
                  }}
                >
                  <Icon name="plus" size={12} />
                  Hora
                </button>
              </span>
            )}
          </div>
          <div className={s.row3}>
            <label className={s.label}>
              Antecedência mínima (horas)
              <input className={s.input} inputMode="numeric" value={v.advanceHours} disabled={!canEdit} onChange={(e) => set({ advanceHours: num(e.target.value) })} />
            </label>
            <label className={s.label}>
              Cancelar ou remarcar até (horas antes)
              <input className={s.input} inputMode="numeric" value={v.cancelHours} disabled={!canEdit} onChange={(e) => set({ cancelHours: num(e.target.value) })} />
            </label>
            <label className={s.label}>
              Acompanhantes
              <input className={s.input} inputMode="numeric" value={v.companions} disabled={!canEdit} onChange={(e) => set({ companions: num(e.target.value) })} />
            </label>
          </div>
          <label className={s.check}>
            <input type="checkbox" checked={v.noShowFee} disabled={!canEdit} onChange={() => set({ noShowFee: !v.noShowFee })} />
            Falta sem aviso: o valor pago passa a taxa de serviço
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={v.requireTerms} disabled={!canEdit} onChange={() => set({ requireTerms: !v.requireTerms })} />
            Pedir aceitação dos termos antes de pagar
          </label>
        </div>
      </section>

      {canEdit && (
        <div className={b.save}>
          {result && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.message}</span>}
          <button
            type="button"
            className={s.btn}
            disabled={!dirty || pending}
            onClick={() => start(async () => setResult(await saveBridalSettingsAction(v)))}
          >
            Guardar pacotes e regras
          </button>
        </div>
      )}
    </div>
  );
}
