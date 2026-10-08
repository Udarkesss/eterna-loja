"use client";

import { useState, useTransition } from "react";
import { saveSystemAction, type SettingsResult } from "@/app/gestao/actions/settings";
import type { FittingSettings } from "@/data/fittings";
import type { Localized } from "@/types";
import s from "./admin.module.css";

/** EN: Store details and fitting schedule form. PT: Formulário das lojas e do horário das provas. */

interface StoreForm {
  id: string;
  code: string;
  name: string;
  location: string;
  phone: string;
  hours: Localized;
}

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function SystemEditor(props: { stores: StoreForm[]; schedule: FittingSettings }) {
  const [stores, setStores] = useState(props.stores);
  const [sc, setSc] = useState(props.schedule);
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();
  const upd = (i: number, patch: Partial<StoreForm>) => {
    setStores(stores.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setResult(null);
  };
  const setS = (patch: Partial<FittingSettings>) => {
    setSc({ ...sc, ...patch });
    setResult(null);
  };

  return (
    <>
      <div className={s.top} style={{ marginTop: -16, justifyContent: "flex-end" }}>
        <div className={s.actions}>
          {result && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓ Guardado" : result.message}</span>}
          <button className={s.btn} disabled={pending} onClick={() => start(async () => setResult(await saveSystemAction({ stores, schedule: sc })))}>
            Guardar alterações
          </button>
        </div>
      </div>

      <div className={s.split2}>
        {stores.map((st, i) => (
          <section key={st.id} className={s.card}>
            <h2 className={s.h2}>Loja {st.code}</h2>
            <label className={s.label}>
              Nome
              <input className={s.input} value={st.name} onChange={(e) => upd(i, { name: e.target.value })} />
            </label>
            <label className={s.label}>
              Morada
              <input className={s.input} value={st.location} onChange={(e) => upd(i, { location: e.target.value })} />
            </label>
            <label className={s.label}>
              Telefone / WhatsApp
              <input className={s.input} value={st.phone} onChange={(e) => upd(i, { phone: e.target.value })} />
              <span className={s.hint}>É para este número que abre o WhatsApp dos pedidos de prova desta loja.</span>
            </label>
            <div className={s.row2}>
              <label className={s.label}>
                Horário (PT)
                <input className={s.input} value={st.hours.pt} onChange={(e) => upd(i, { hours: { ...st.hours, pt: e.target.value } })} placeholder="SEG–SÁB 09:00–18:00" />
              </label>
              <label className={s.label}>
                Horário (EN)
                <input className={s.input} value={st.hours.en} onChange={(e) => upd(i, { hours: { ...st.hours, en: e.target.value } })} placeholder="MON–SAT 09:00–18:00" />
              </label>
            </div>
          </section>
        ))}
      </div>

      <section className={s.card}>
        <h2 className={s.h2}>Horário das provas</h2>
        <fieldset className={s.fieldset}>
          <legend className={s.legend}>Dias com provas</legend>
          <div className={s.checks}>
            {DAYS.map((d, n) => (
              <label key={d}>
                <input type="checkbox" checked={sc.days.includes(n)} onChange={() => setS({ days: sc.days.includes(n) ? sc.days.filter((x) => x !== n) : [...sc.days, n].sort() })} />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
        <div className={s.row3}>
          <label className={s.label}>
            Abre
            <input className={s.input} type="time" value={sc.open} onChange={(e) => setS({ open: e.target.value })} />
          </label>
          <label className={s.label}>
            Fecha
            <input className={s.input} type="time" value={sc.close} onChange={(e) => setS({ close: e.target.value })} />
          </label>
          <label className={s.label}>
            Intervalo entre horas (min)
            <input className={s.input} type="number" min={15} step={15} value={sc.stepMinutes} onChange={(e) => setS({ stepMinutes: Number(e.target.value) })} />
          </label>
          <label className={s.label}>
            Duração · noiva (min)
            <input className={s.input} type="number" min={15} step={15} value={sc.bridalMinutes} onChange={(e) => setS({ bridalMinutes: Number(e.target.value) })} />
          </label>
          <label className={s.label}>
            Duração · outras (min)
            <input className={s.input} type="number" min={15} step={15} value={sc.defaultMinutes} onChange={(e) => setS({ defaultMinutes: Number(e.target.value) })} />
          </label>
          <label className={s.label}>
            Antecedência mínima (horas)
            <input className={s.input} type="number" min={0} value={sc.leadHours} onChange={(e) => setS({ leadHours: Number(e.target.value) })} />
          </label>
        </div>
        <span className={s.hint}>Cada loja recebe uma prova de cada vez. Valores provisórios até a Eterna confirmar o horário real.</span>
      </section>
    </>
  );
}
