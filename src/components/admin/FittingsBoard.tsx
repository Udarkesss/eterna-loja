"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  fittingNotesAction,
  fittingStatusAction,
  newFittingAction,
  proposeTimeAction,
  type FittingActionResult,
} from "@/app/gestao/actions/fittings";
import { Icon } from "@/components/ui/Icon";
import { FITTING_KIND_LABELS, FITTING_STATUS_LABELS } from "@/data/fittings";
import { FITTING_KINDS, type FittingStatus } from "@/types";
import s from "./admin.module.css";
import b from "./FittingsBoard.module.css";

/**
 * EN: Interactive part of "Gestão · 5 Provas": calendar, selected fitting (confirm, WhatsApp reminder, done / missed,
 *     reschedule), "Pedidos pelo site" (Aceitar / Propor outra hora) and "Nova prova".
 * PT: Parte interactiva das Provas: calendário, prova seleccionada, pedidos pelo site e nova prova.
 */

export interface BoardFitting {
  id: string;
  code: string;
  date: string;
  time: string;
  dayLabel: string;
  client: string;
  phone: string;
  kind: string;
  storeCode: string;
  storeName: string;
  status: FittingStatus;
  source: string;
  notes: string | null;
  internalNotes: string;
  duration: number;
  pieces: { url: string; code: string }[];
  reminderUrl: string;
  publicUrl: string;
  isDemo: boolean;
}

const TONE: Record<FittingStatus, string> = {
  requested: "var(--champagne-deep)",
  pending: "var(--warning)",
  confirmed: "var(--success)",
  done: "var(--ink)",
  no_show: "var(--danger)",
  cancelled: "var(--ink-muted)",
};

export function FittingsBoard(props: {
  days: { date: string; label: string; isToday: boolean; items: BoardFitting[] }[];
  requests: BoardFitting[];
  selectedId: string | null;
  stores: { code: string; name: string }[];
  storeFilter: string;
  week: { monday: string; prev: string; next: string; isCurrent: boolean };
  today: string;
}) {
  const all = useMemo(() => [...props.days.flatMap((d) => d.items), ...props.requests], [props.days, props.requests]);
  const [selId, setSelId] = useState(props.selectedId ?? all[0]?.id ?? null);
  const sel = all.find((f) => f.id === selId) ?? null;
  const [pending, start] = useTransition();
  const [result, setResult] = useState<FittingActionResult | null>(null);
  const [resched, setResched] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<FittingActionResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) setResched(false);
    });

  const q = (extra: Record<string, string>) => `?${new URLSearchParams({ semana: props.week.monday, loja: props.storeFilter, ...extra })}`;

  return (
    <>
      <div className={s.top} style={{ alignItems: "center" }}>
        <div className={s.segment} role="radiogroup" aria-label="Loja">
          {[{ code: "all", name: "Todas" }, ...props.stores].map((st) => (
            <Link key={st.code} href={q({ loja: st.code })} aria-current={props.storeFilter === st.code ? "true" : undefined}>
              {st.code === "all" ? "Todas" : `Loja ${st.code}${st.code === "22" ? " · Bridal" : ""}`}
            </Link>
          ))}
        </div>
        <div className={s.actions}>
          <Link href={q({ semana: props.week.prev })} className={`${s.btnOutline} ${s.small}`} aria-label="Semana anterior">
            ←
          </Link>
          {!props.week.isCurrent && (
            <Link href={q({ semana: props.today })} className={`${s.btnOutline} ${s.small}`}>
              Esta semana
            </Link>
          )}
          <Link href={q({ semana: props.week.next })} className={`${s.btnOutline} ${s.small}`} aria-label="Semana seguinte">
            →
          </Link>
          <button className={s.btn} onClick={() => setNewOpen(!newOpen)}>
            <Icon name="plus" size={16} />
            Nova prova
          </button>
        </div>
      </div>

      {result?.message && (
        <div className={result.ok ? s.notice : s.error} style={{ alignItems: "center", justifyContent: "space-between" }}>
          <span>{result.message}</span>
          {result.whatsappUrl && (
            <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer" className={`${s.btn} ${s.small}`}>
              <Icon name="whatsapp" size={14} />
              Enviar no WhatsApp
            </a>
          )}
        </div>
      )}

      {newOpen && (
        <form
          className={s.card}
          action={(form) =>
            run(async () => {
              const r = await newFittingAction(form);
              if (r.ok) setNewOpen(false);
              return r;
            })
          }
        >
          <div className={s.cardHead}>
            <h2 className={s.h2}>Nova prova</h2>
            <span className={s.muted}>Para pedidos que chegam por WhatsApp, telefone ou na loja. Fica logo confirmada.</span>
          </div>
          <div className={s.row3}>
            <label className={s.label}>
              Nome
              <input className={s.input} name="name" required minLength={2} />
            </label>
            <label className={s.label}>
              Telefone
              <input className={s.input} name="phone" type="tel" inputMode="numeric" placeholder="84 123 4567" required />
            </label>
            <label className={s.label}>
              Tipo
              <select className={s.select} name="kind" defaultValue="bride_white">
                {FITTING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FITTING_KIND_LABELS[k].pt}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Loja
              <select className={s.select} name="store" defaultValue={props.stores[0]?.code}>
                {props.stores.map((st) => (
                  <option key={st.code} value={st.code}>
                    Loja {st.code} · {st.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Dia
              <input className={s.input} name="date" type="date" min={props.today} required />
            </label>
            <label className={s.label}>
              Hora
              <input className={s.input} name="time" type="time" step={1800} required />
            </label>
          </div>
          <div className={s.row2}>
            <label className={s.label}>
              Chegou por
              <select className={s.select} name="source" defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="store">Loja / telefone</option>
              </select>
            </label>
            <label className={s.label}>
              Notas
              <input className={s.input} name="notes" placeholder="Ex.: tamanho habitual 38" />
            </label>
          </div>
          <div className={s.actions}>
            <button type="submit" className={s.btn} disabled={pending}>
              Criar prova
            </button>
            <button type="button" className={s.btnOutline} onClick={() => setNewOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className={b.layout}>
        <section className={s.card}>
          <h2 className={s.h2}>Calendário</h2>
          <div className={b.calendar}>
            {props.days.map((d) => (
              <div key={d.date} className={b.day} data-today={d.isToday || undefined}>
                <span className={b.dayLabel}>{d.label}</span>
                {d.items.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={a.id === selId}
                    onClick={() => {
                      setSelId(a.id);
                      setResched(false);
                      setResult(null);
                    }}
                    className={b.appt}
                    data-store={a.storeCode}
                    style={{ borderLeftColor: TONE[a.status] }}
                  >
                    <span className={b.time}>{a.time}</span>
                    <span className={b.client}>{a.client}</span>
                    <span className={b.kind}>{a.kind}</span>
                    <span className={b.status} style={{ color: TONE[a.status] }}>
                      {FITTING_STATUS_LABELS[a.status]}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className={b.legend}>
            <span data-store="22">Loja 22 · Bridal</span>
            <span data-store="02">Loja 02 · Ocasiões</span>
          </div>
        </section>

        <div className={s.stack}>
          <section className={s.card}>
            {!sel ? (
              <p className={s.muted}>Escolha uma prova no calendário.</p>
            ) : (
              <>
                <div className={s.cardHead}>
                  <h2 className={s.h2}>{sel.client}</h2>
                  <span className={s.muted}>
                    {sel.code}
                    {sel.isDemo ? " · exemplo" : ""}
                  </span>
                </div>
                <dl className={s.dl}>
                  <dt>Quando</dt>
                  <dd>
                    {sel.dayLabel}, {sel.time} · {sel.duration} min
                  </dd>
                  <dt>Loja</dt>
                  <dd>
                    Loja {sel.storeCode} · {sel.storeName}
                  </dd>
                  <dt>Tipo</dt>
                  <dd>{sel.kind}</dd>
                  <dt>Telefone</dt>
                  <dd>{sel.phone}</dd>
                  <dt>Estado</dt>
                  <dd>
                    <strong style={{ fontWeight: 500, color: TONE[sel.status] }}>{FITTING_STATUS_LABELS[sel.status]}</strong>
                    <span className={s.muted}> · {sel.source === "site" ? "pelo site" : sel.source === "whatsapp" ? "pelo WhatsApp" : "na loja"}</span>
                  </dd>
                  {sel.notes && (
                    <>
                      <dt>Da cliente</dt>
                      <dd>{sel.notes}</dd>
                    </>
                  )}
                </dl>
                <div className={s.fieldset}>
                  <span className={s.legend}>Peças a preparar</span>
                  {sel.pieces.length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {sel.pieces.map((p) => (
                        <span key={p.code} className={s.two} style={{ alignItems: "center" }}>
                          <Image src={p.url} alt="" width={64} height={80} style={{ width: 64, height: 80, objectFit: "cover" }} />
                          <span className={s.muted}>{p.code}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className={s.muted}>Nenhuma peça escolhida.</span>
                  )}
                  <a href={sel.publicUrl} target="_blank" className={s.a} style={{ fontSize: 13 }}>
                    Ver página do pedido ↗
                  </a>
                </div>
                <label className={s.label}>
                  Notas
                  <textarea className={s.textarea} rows={2} value={notes[sel.id] ?? sel.internalNotes} onChange={(e) => setNotes({ ...notes, [sel.id]: e.target.value })} />
                </label>
                {notes[sel.id] !== undefined && notes[sel.id] !== sel.internalNotes && (
                  <button className={`${s.btnOutline} ${s.small}`} style={{ alignSelf: "flex-start" }} disabled={pending} onClick={() => run(() => fittingNotesAction(sel.id, notes[sel.id]))}>
                    Guardar nota
                  </button>
                )}

                <div className={s.fieldset}>
                  {(sel.status === "requested" || sel.status === "pending") && (
                    <button className={s.btn} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "confirmed"))}>
                      Confirmar prova
                    </button>
                  )}
                  <a href={sel.reminderUrl} target="_blank" rel="noopener noreferrer" className={s.btnOutline}>
                    <Icon name="whatsapp" size={16} />
                    Lembrete no WhatsApp
                  </a>
                  {sel.status === "confirmed" && (
                    <div className={s.row2}>
                      <button className={s.btnOutline} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "done"))}>
                        Realizada
                      </button>
                      <button className={s.btnDanger} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "no_show"))}>
                        Faltou
                      </button>
                    </div>
                  )}
                  {!resched ? (
                    <button type="button" className={s.linkBtn} style={{ alignSelf: "flex-start" }} onClick={() => setResched(true)}>
                      Remarcar
                    </button>
                  ) : (
                    <Reschedule id={sel.id} date={sel.date} time={sel.time} min={props.today} pending={pending} onSubmit={(d, t) => run(() => proposeTimeAction(sel.id, d, t))} onCancel={() => setResched(false)} />
                  )}
                  {(sel.status === "requested" || sel.status === "pending" || sel.status === "confirmed") && (
                    <button
                      type="button"
                      className={s.linkBtn}
                      style={{ alignSelf: "flex-start", color: "var(--danger)" }}
                      onClick={() => window.confirm("Cancelar esta prova?") && run(() => fittingStatusAction(sel.id, "cancelled"))}
                    >
                      Cancelar prova
                    </button>
                  )}
                </div>
              </>
            )}
          </section>

          <section className={s.card}>
            <h2 className={s.h2}>Pedidos pelo site</h2>
            {props.requests.length === 0 ? (
              <p className={s.muted}>Sem pedidos por responder.</p>
            ) : (
              <ul className={s.list}>
                {props.requests.map((r) => (
                  <li key={r.id} className={s.listItem} style={{ flexDirection: "column", gap: 8 }}>
                    <button type="button" className={s.two} style={{ border: 0, background: "none", padding: 0, textAlign: "left" }} onClick={() => setSelId(r.id)}>
                      <span className={s.strong}>{r.client}</span>
                      <span className={s.muted}>
                        Pediu {r.dayLabel}, {r.time} · {r.kind} · Loja {r.storeCode}
                      </span>
                    </button>
                    <span className={s.actions}>
                      <button className={`${s.btn} ${s.small}`} disabled={pending} onClick={() => run(() => fittingStatusAction(r.id, "confirmed"))}>
                        Aceitar
                      </button>
                      <button
                        className={`${s.btnOutline} ${s.small}`}
                        onClick={() => {
                          setSelId(r.id);
                          setResched(true);
                        }}
                      >
                        Propor outra hora
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Reschedule(props: { id: string; date: string; time: string; min: string; pending: boolean; onSubmit: (d: string, t: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(props.date);
  const [time, setTime] = useState(props.time);
  return (
    <div className={s.fieldset} style={{ padding: 12, border: "1px solid var(--line)", background: "var(--ivory)" }}>
      <div className={s.row2}>
        <label className={s.label}>
          Novo dia
          <input className={s.input} type="date" min={props.min} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={s.label}>
          Nova hora
          <input className={s.input} type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <span className={s.hint}>A prova fica “Por confirmar” e prepara a mensagem de proposta para a cliente.</span>
      <div className={s.actions}>
        <button className={`${s.btn} ${s.small}`} disabled={props.pending} onClick={() => props.onSubmit(date, time)}>
          Propor esta hora
        </button>
        <button className={`${s.btnOutline} ${s.small}`} onClick={props.onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
