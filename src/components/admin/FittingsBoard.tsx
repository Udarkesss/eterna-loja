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
import { FITTING_STATUS_LABELS } from "@/data/fittings";
import type { FittingStatus } from "@/types";
import s from "./admin.module.css";
import d3 from "./Dashboard.module.css";
import b from "./FittingsBoard.module.css";

/**
 * EN: Interactive part of "Provas de noiva" (design V3): the next fitting days by start time, "Pedidos pelo site"
 *     (Confirmar · Propor outra hora · WhatsApp), the selected fitting (notes, reminder, done / missed, reschedule,
 *     cancel) and "Nova prova".
 * PT: Parte interactiva das Provas de noiva (V3): os próximos dias de prova por hora, pedidos pelo site, a prova
 *     seleccionada e "Nova prova".
 */

export interface BoardFitting {
  id: string;
  code: string;
  date: string;
  time: string;
  dayLabel: string;
  dayShort: string;
  client: string;
  phone: string;
  kind: string;
  packageLine: string;
  paidLine: string;
  paid: boolean;
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

/** EN: The grid row of a fitting: its start time, or the last listed hour before it. PT: A linha da hora de início. */
function rowOf(time: string, hours: string[]): string {
  return [...hours].reverse().find((h) => h <= time) ?? hours[0];
}

export function FittingsBoard(props: {
  range: string;
  dates: { date: string; label: string; isToday: boolean }[];
  hours: string[];
  fittings: BoardFitting[];
  requests: BoardFitting[];
  selectedId: string | null;
  prev: string;
  next: string;
  today: string;
  kinds: { key: string; label: string }[];
  packages: { key: string; name: string; dresses: number }[];
  extraMax: number;
}) {
  const all = useMemo(() => [...props.fittings, ...props.requests], [props.fittings, props.requests]);
  const [selId, setSelId] = useState(props.selectedId);
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
  const select = (id: string) => {
    setSelId(id);
    setResched(false);
    setResult(null);
  };

  return (
    <>
      <div className={b.newRow}>
        <button className={s.btn} onClick={() => setNewOpen(!newOpen)}>
          <Icon name="plus" size={16} />
          Nova prova
        </button>
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
          <input type="hidden" name="store" value="22" />
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
              Colecção
              <select className={s.select} name="kind" defaultValue={props.kinds[0]?.key}>
                {props.kinds.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Pacote
              <select className={s.select} name="package" defaultValue={props.packages[0]?.key}>
                {props.packages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name} · {p.dresses} vestidos
                  </option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Vestidos extra
              <input className={s.input} name="extras" type="number" min={0} max={props.extraMax} defaultValue={0} />
            </label>
            <label className={s.label}>
              Dia
              <input className={s.input} name="date" type="date" min={props.today} required />
            </label>
            <label className={s.label}>
              Hora
              <select className={s.select} name="time" defaultValue={props.hours[0]}>
                {props.hours.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <label className={s.label}>
              Chegou por
              <select className={s.select} name="source" defaultValue="whatsapp">
                <option value="whatsapp">WhatsApp</option>
                <option value="store">Loja / telefone</option>
              </select>
            </label>
            <label className={s.label}>
              Notas
              <input className={s.input} name="notes" placeholder="Ex.: casamento a 14 de março" />
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
        <div className={d3.col}>
          <section className={d3.panel}>
            <div className={d3.panelHead}>
              <h2>{props.range}</h2>
            </div>
            <div className={d3.panelBody}>
              <div className={b.calTop}>
                <div className={b.pager}>
                  <Link href={props.prev} aria-label="Dias de prova anteriores">
                    <Icon name="chevronLeft" size={18} />
                  </Link>
                  <span>Próximos dias de prova</span>
                  <Link href={props.next} aria-label="Dias de prova seguintes">
                    <Icon name="chevronRight" size={18} />
                  </Link>
                </div>
                <span className={b.legend}>
                  <span data-tone="ok">Confirmada</span>
                  <span data-tone="warn">Por confirmar</span>
                </span>
              </div>
              {props.dates.length === 0 ? (
                <p className={d3.empty}>Escolha os dias de prova em “Regras e agenda”.</p>
              ) : (
                <div className={b.grid} style={{ gridTemplateColumns: `70px repeat(${props.dates.length}, minmax(96px, 1fr))` }}>
                  <span className={b.corner} />
                  {props.dates.map((d) => (
                    <span key={d.date} className={b.dayHead} data-today={d.isToday || undefined}>
                      {d.label}
                    </span>
                  ))}
                  {props.hours.map((h) => (
                    <div key={h} className={b.row}>
                      <span className={b.hour}>{h}</span>
                      {props.dates.map((d) => (
                        <div key={d.date} className={b.cell}>
                          {props.fittings
                            .filter((f) => f.date === d.date && rowOf(f.time, props.hours) === h)
                            .map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className={b.booking}
                                data-tone={f.status === "confirmed" || f.status === "done" ? "ok" : f.status === "no_show" ? "bad" : "warn"}
                                aria-pressed={f.id === selId}
                                onClick={() => select(f.id)}
                              >
                                <b>{f.client}</b>
                                {f.time !== h && ` · ${f.time}`}
                                <br />
                                {f.packageLine}
                              </button>
                            ))}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {sel && (
            <section className={d3.panel}>
              <div className={d3.panelHead}>
                <h2>{sel.client}</h2>
                <span className={d3.muted}>
                  {sel.code}
                  {sel.isDemo ? " · exemplo" : ""}
                </span>
              </div>
              <div className={d3.panelBody}>
                <dl className={s.dl}>
                  <dt>Quando</dt>
                  <dd>
                    {sel.dayLabel}, {sel.time} · {sel.duration} min
                  </dd>
                  <dt>Pacote</dt>
                  <dd>
                    {sel.packageLine}
                    {sel.paidLine && ` · ${sel.paidLine}`}
                  </dd>
                  <dt>Telefone</dt>
                  <dd>{sel.phone}</dd>
                  <dt>Estado</dt>
                  <dd>
                    <strong style={{ fontWeight: 500 }}>{FITTING_STATUS_LABELS[sel.status]}</strong>
                    <span className={s.muted}> · {sel.source === "site" ? "pelo site" : sel.source === "whatsapp" ? "pelo WhatsApp" : "na loja"}</span>
                  </dd>
                  {sel.notes && (
                    <>
                      <dt>Da noiva</dt>
                      <dd>{sel.notes}</dd>
                    </>
                  )}
                </dl>
                <span className={s.legend}>Vestidos a preparar</span>
                {sel.pieces.length ? (
                  <span className={b.thumbs}>
                    {sel.pieces.map((p) => (
                      <span key={p.code} className={s.two} style={{ alignItems: "center" }}>
                        <Image src={p.url} alt="" width={64} height={80} />
                        <span className={s.muted}>{p.code}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={s.muted}>Nenhum vestido escolhido.</span>
                )}
                <a href={sel.publicUrl} target="_blank" className={s.a} style={{ fontSize: 13 }}>
                  Ver página do pedido ↗
                </a>
                <label className={s.label}>
                  Notas
                  <textarea className={s.textarea} rows={2} value={notes[sel.id] ?? sel.internalNotes} onChange={(e) => setNotes({ ...notes, [sel.id]: e.target.value })} />
                </label>
                {notes[sel.id] !== undefined && notes[sel.id] !== sel.internalNotes && (
                  <button className={`${s.btnOutline} ${s.small}`} style={{ alignSelf: "flex-start" }} disabled={pending} onClick={() => run(() => fittingNotesAction(sel.id, notes[sel.id]))}>
                    Guardar nota
                  </button>
                )}
                <div className={s.actions}>
                  {(sel.status === "requested" || sel.status === "pending") && (
                    <button className={s.btn} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "confirmed"))}>
                      Confirmar
                    </button>
                  )}
                  {sel.reminderUrl && (
                    <a href={sel.reminderUrl} target="_blank" rel="noopener noreferrer" className={s.btnOutline}>
                      <Icon name="whatsapp" size={16} />
                      Lembrete no WhatsApp
                    </a>
                  )}
                  {sel.status === "confirmed" && (
                    <>
                      <button className={s.btnOutline} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "done"))}>
                        Realizada
                      </button>
                      <button className={s.btnDanger} disabled={pending} onClick={() => run(() => fittingStatusAction(sel.id, "no_show"))}>
                        Faltou
                      </button>
                    </>
                  )}
                </div>
                {!resched ? (
                  <button type="button" className={s.linkBtn} style={{ alignSelf: "flex-start" }} onClick={() => setResched(true)}>
                    Propor outra hora
                  </button>
                ) : (
                  <Reschedule date={sel.date} time={sel.time} hours={props.hours} min={props.today} pending={pending} onSubmit={(d, t) => run(() => proposeTimeAction(sel.id, d, t))} onCancel={() => setResched(false)} />
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
            </section>
          )}
        </div>

        <section className={d3.panel}>
          <div className={d3.panelHead}>
            <h2>Pedidos pelo site</h2>
            {props.requests.length > 0 && <span className={d3.count}>{props.requests.length}</span>}
          </div>
          {props.requests.length === 0 ? (
            <p className={d3.empty}>Sem pedidos por responder.</p>
          ) : (
            <ul className={b.requests}>
              {props.requests.map((r) => (
                <li key={r.id}>
                  <div className={b.reqHead}>
                    <button type="button" onClick={() => select(r.id)}>
                      <b>{r.client}</b> · {r.code}
                    </button>
                    <span className={s.chip} data-tone="warn">
                      {r.paid ? "Paga · por confirmar" : "Por confirmar"}
                    </span>
                  </div>
                  <span className={d3.muted}>{[`${r.dayShort} · ${r.time}`, r.packageLine, r.paidLine, r.notes].filter(Boolean).join(" · ")}</span>
                  {r.pieces.length > 0 && (
                    <span className={b.thumbs}>
                      {r.pieces.map((p) => (
                        <Image key={p.code} src={p.url} alt={p.code} width={36} height={48} />
                      ))}
                    </span>
                  )}
                  <span className={s.actions}>
                    <button className={`${s.btn} ${s.small}`} disabled={pending} onClick={() => run(() => fittingStatusAction(r.id, "confirmed"))}>
                      Confirmar
                    </button>
                    <button
                      className={`${s.btnOutline} ${s.small}`}
                      onClick={() => {
                        select(r.id);
                        setResched(true);
                      }}
                    >
                      Propor outra hora
                    </button>
                    <a href={r.reminderUrl} target="_blank" rel="noopener noreferrer" className={`${s.btnOutline} ${s.small}`}>
                      <Icon name="whatsapp" size={14} />
                      WhatsApp
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Reschedule(props: { date: string; time: string; hours: string[]; min: string; pending: boolean; onSubmit: (d: string, t: string) => void; onCancel: () => void }) {
  const [date, setDate] = useState(props.date);
  const [time, setTime] = useState(props.hours.includes(props.time) ? props.time : props.hours[0]);
  return (
    <div className={s.fieldset} style={{ padding: 12, border: "1px solid var(--line)", background: "var(--surface)" }}>
      <div className={s.row2}>
        <label className={s.label}>
          Novo dia
          <input className={s.input} type="date" min={props.min} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={s.label}>
          Nova hora
          <select className={s.select} value={time} onChange={(e) => setTime(e.target.value)}>
            {props.hours.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
      </div>
      <span className={s.hint}>A prova fica “Por confirmar” e prepara a mensagem de proposta para a noiva.</span>
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
