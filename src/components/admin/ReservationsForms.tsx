"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  cancelReservationAction,
  completeReservationAction,
  createStoreReservationAction,
  extendReservationAction,
  type ReservationActionResult,
} from "@/app/gestao/actions/reservations";
import { Icon } from "@/components/ui/Icon";
import { formatMZN } from "@/lib/format";
import c from "./AdminV3.module.css";

/**
 * EN: Interactive parts of "Gestão · Reservas" (design V3): "Nova reserva na loja", the actions of each row and the
 *     "Prolongar a reserva" window.
 * PT: Partes interactivas de Reservas (V3): "Nova reserva na loja", as acções de cada linha e a janela "Prolongar".
 */

function Feedback({ result }: { result: ReservationActionResult | null }) {
  if (!result) return null;
  return (
    <span role={result.ok ? "status" : "alert"} className={result.ok ? c.ok : c.err}>
      {result.message}
    </span>
  );
}

function Modal({ title, narrow, onClose, children }: { title: string; narrow?: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className={c.modalBack} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${c.modal} ${narrow ? c.modalNarrow : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className={c.panelH}>
          <h3>{title}</h3>
          <button type="button" className={c.icoBtn} onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type Piece = { id: string; label: string; price: number; storeCode: string };
type Person = { id: string; name: string; phone: string | null };

const parseMt = (v: string) => {
  const clean = v.replace(/[^\d,.]/g, "").replace(/\./g, "").split(",")[0];
  return clean ? Number(clean) : 0;
};
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function NewStoreReservation(props: {
  pieces: Piece[];
  people: Person[];
  stores: { code: string; days: number }[];
  depositPct: number;
  remindDays: number;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState("");
  const [pieceText, setPieceText] = useState("");
  const [store, setStore] = useState(props.stores[0]?.code ?? "02");
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<"cash" | "mpesa" | "emola" | "mkesh" | "card" | "transfer">("cash");
  const [accepted, setAccepted] = useState(true);
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ReservationActionResult | null>(null);

  const person = props.people.find((p) => `${p.phone ? `+258 ${p.phone} · ` : ""}${p.name}` === who) ?? null;
  const piece = props.pieces.find((p) => p.label === pieceText) ?? null;
  // EN: Choosing a piece suggests its store and a 50% deposit. PT: Escolher a peça sugere a loja e o sinal de 50%.
  useEffect(() => {
    if (!piece) return;
    setStore(piece.storeCode);
    setDeposit(formatMZN(Math.round((piece.price * props.depositPct) / 100), "pt"));
  }, [piece, props.depositPct]);
  const days = props.stores.find((s) => s.code === store)?.days ?? 30;
  const until = useMemo(() => {
    const d = new Date(Date.now() + days * 86_400_000);
    return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  }, [days]);
  const typedPhone = who.replace(/[^\d]/g, "");
  const name = person?.name ?? who.replace(/[+\d·]/g, " ").replace(/\s+/g, " ").trim();

  const submit = () =>
    start(async () => {
      const r = await createStoreReservationAction({
        customerId: person?.id ?? null,
        name,
        phone: person?.phone ?? (typedPhone.length >= 9 ? typedPhone : ""),
        variantId: piece?.id ?? "",
        storeCode: store,
        deposit: parseMt(deposit),
        method,
        accepted: accepted as true,
      });
      setRes(r);
      if (r.ok) {
        setOpen(false);
        setWho("");
        setPieceText("");
        setDeposit("");
      }
    });

  return (
    <>
      <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={() => setOpen(true)} disabled={props.disabled}>
        <Icon name="plus" size={15} />
        Nova reserva na loja
      </button>
      {res?.ok && <Feedback result={res} />}
      {open && (
        <Modal title="Nova reserva na loja" onClose={() => setOpen(false)}>
          <div className={c.panelB}>
            <div className={c.half}>
              <label className={c.field}>
                <span className={c.lbl}>Cliente (telefone ou nome)</span>
                <input className={c.input} list="res-people" value={who} onChange={(e) => setWho(e.target.value)} placeholder="+258 84 123 4567 · Nome" />
                <datalist id="res-people">
                  {props.people.map((p) => (
                    <option key={p.id} value={`${p.phone ? `+258 ${p.phone} · ` : ""}${p.name}`} />
                  ))}
                </datalist>
                <span className={c.help}>{person ? "Associada à conta: os pontos contam quando pagar tudo." : "Sem conta: escreva o nome e o telefone."}</span>
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Peça (código)</span>
                <input className={c.input} list="res-pieces" value={pieceText} onChange={(e) => setPieceText(e.target.value)} placeholder="Código · cor · tamanho" />
                <datalist id="res-pieces">
                  {props.pieces.map((p) => (
                    <option key={p.id} value={p.label} />
                  ))}
                </datalist>
                {piece && <span className={c.help}>Preço {formatMZN(piece.price, "pt")}</span>}
              </label>
            </div>
            <div className={c.three}>
              <label className={c.field}>
                <span className={c.lbl}>Loja</span>
                <select className={c.select} value={store} onChange={(e) => setStore(e.target.value)}>
                  {props.stores.map((s) => (
                    <option key={s.code} value={s.code}>
                      Loja {Number(s.code)} · {s.days} dias
                    </option>
                  ))}
                </select>
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Sinal pago ({props.depositPct}%)</span>
                <input className={`${c.input} ${c.num}`} value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" />
              </label>
              <label className={c.field}>
                <span className={c.lbl}>Método</span>
                <select className={c.select} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  <option value="cash">Dinheiro</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="emola">e-Mola</option>
                  <option value="mkesh">mKesh</option>
                  <option value="card">Cartão</option>
                  <option value="transfer">Transferência</option>
                </select>
              </label>
            </div>
            <div className={c.note}>
              <Icon name="calendar" size={18} />
              <span>
                Guardada até <b>{until}</b>. Avisamos a cliente por WhatsApp {props.remindDays} dias antes.
              </span>
            </div>
            <label className={c.check}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>A cliente aceitou as condições de reserva: se não levantar no prazo, perde a peça e o sinal, sem reembolso.</span>
            </label>
            {res && !res.ok && <Feedback result={res} />}
            <div className={c.end}>
              <button type="button" className={`${c.btn} ${c.sm}`} onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button type="button" className={`${c.btnPrimary} ${c.sm}`} onClick={submit} disabled={pending || !piece || !name || !accepted}>
                Registar reserva
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ReservationActions(props: {
  id: string;
  number: string;
  code: string;
  customer: string;
  remindHref: string | null;
  canExtend: boolean;
  expiresAt: string | null;
  extendTo: string | null;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<ReservationActionResult | null>(null);
  const [extend, setExtend] = useState(false);
  const run = (act: () => Promise<ReservationActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const r = await act();
      setRes(r);
      if (r.ok) setExtend(false);
    });
  };
  return (
    <span className={c.row} style={{ gap: 6, flexWrap: "wrap" }}>
      {props.remindHref && (
        <a className={`${c.btn} ${c.xs}`} href={props.remindHref} target="_blank" rel="noopener noreferrer">
          <Icon name="whatsapp" size={14} />
          Avisar
        </a>
      )}
      <button
        type="button"
        className={`${c.btn} ${c.xs}`}
        disabled={props.disabled || pending}
        onClick={() => run(() => completeReservationAction(props.id), `Confirmar que ${props.customer} levantou o ${props.code} e pagou o restante?`)}
      >
        Levantada e paga
      </button>
      {props.canExtend && (
        <button type="button" className={c.textBtn} disabled={props.disabled || pending} onClick={() => setExtend(true)}>
          Prolongar
        </button>
      )}
      <button
        type="button"
        className={c.textBtn}
        data-tone="bad"
        disabled={props.disabled || pending}
        onClick={() => run(() => cancelReservationAction(props.id), `Cancelar a reserva ${props.number}? A peça volta à venda e o sinal fica retido.`)}
      >
        Cancelar
      </button>
      {res && !extend && <Feedback result={res} />}
      {extend && (
        <Modal title="Prolongar a reserva" narrow onClose={() => setExtend(false)}>
          <div className={c.panelB}>
            <span className={c.small}>
              {props.number} · {props.code} · {props.customer}
            </span>
            <div className={c.kv}>
              <span>Termina a</span>
              <b>{props.expiresAt}</b>
            </div>
            <div className={c.kv}>
              <span>Prolongar por</span>
              <b>{props.extendTo}</b>
            </div>
            <span className={c.xsMuted}>Regra: uma vez por reserva (Definições). Fica no registo de auditoria.</span>
            {res && !res.ok && <Feedback result={res} />}
            <div className={c.end}>
              <button type="button" className={`${c.btn} ${c.sm}`} onClick={() => setExtend(false)}>
                Cancelar
              </button>
              <button type="button" className={`${c.btnPrimary} ${c.sm}`} disabled={pending} onClick={() => run(() => extendReservationAction(props.id))}>
                Prolongar e avisar por WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}
    </span>
  );
}
