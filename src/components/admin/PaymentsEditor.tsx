"use client";

import { useState, useTransition } from "react";
import { savePaymentsAction, type SettingsResult } from "@/app/gestao/actions/settings";
import { Icon } from "@/components/ui/Icon";
import type { PaymentMethod } from "@/types";
import s from "./admin.module.css";

/**
 * EN: Payment method switches, notice recipients and events (design "Gestão · 10").
 *     Operator keys never appear here: they live only in the server's .env.local.
 * PT: Interruptores dos métodos, quem recebe avisos e quando. As chaves das operadoras nunca aparecem aqui.
 */

const INFO: Record<PaymentMethod, [string, string]> = {
  card: ["Cartão Visa e Mastercard", "Débito e crédito, com 3-D Secure"],
  mpesa: ["M-Pesa", "Vodacom · números 84 e 85"],
  emola: ["e-Mola", "Movitel · números 86 e 87"],
  mkesh: ["mKesh", "Tmcel · números 82 e 83"],
  transfer: ["Transferência bancária", "Com upload do comprovativo"],
  cod: ["Pagamento na entrega", "Dinheiro, só com entrega ao domicílio"],
};
const ENV = { production: ["Em produção", "ok"], test: ["Modo de teste", "warn"], unconfigured: ["Por configurar", ""] } as const;
const EVENTS = {
  newPaidOrder: "Há uma nova compra paga",
  pendingOver10Min: "Um pagamento está pendente há mais de 10 minutos",
  transferProof: "Chega um comprovativo de transferência",
  cashOnDelivery: "Uma encomenda é paga na entrega",
  customerConfirmed: "A cliente confirma a recepção",
} as const;
type Events = Record<keyof typeof EVENTS, boolean>;

interface Recipient {
  staffUserId: string;
  panel: boolean;
  email: boolean;
  whatsapp: boolean;
  storeId: string | null;
}

export function PaymentsEditor(props: {
  methods: { method: PaymentMethod; enabled: boolean; environment: keyof typeof ENV; note: string }[];
  recipients: Recipient[];
  staff: { id: string; name: string; role: string }[];
  stores: { id: string; code: string }[];
  events: Events;
  mpesaLive: boolean;
}) {
  const [methods, setMethods] = useState(props.methods);
  const [recipients, setRecipients] = useState(props.recipients);
  const [events, setEvents] = useState(props.events);
  const [adding, setAdding] = useState("");
  const [result, setResult] = useState<SettingsResult | null>(null);
  const [pending, start] = useTransition();
  const touch = () => setResult(null);

  const save = () =>
    start(async () => {
      setResult(await savePaymentsAction({ methods: methods.map((m) => ({ method: m.method, enabled: m.enabled })), recipients, events }));
    });

  const flip = (i: number, k: "panel" | "email" | "whatsapp") => {
    setRecipients(recipients.map((r, j) => (j === i ? { ...r, [k]: !r[k] } : r)));
    touch();
  };

  return (
    <>
      <div className={s.top} style={{ marginTop: -16, justifyContent: "flex-end" }}>
        <div className={s.actions}>
          {result && <span className={s.chip} data-tone={result.ok ? "ok" : "bad"}>{result.ok ? "✓ Guardado" : result.message}</span>}
          <button className={s.btn} disabled={pending} onClick={save}>
            Guardar alterações
          </button>
        </div>
      </div>

      <section className={s.cardFlush}>
        <div className={s.cardHead}>
          <h2 className={s.h2}>Métodos de pagamento</h2>
          <span className={s.muted}>{methods.filter((m) => m.enabled).length} de 6 activos</span>
        </div>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Método</th>
              <th>Ligação</th>
              <th>Notas</th>
              <th>No checkout</th>
            </tr>
          </thead>
          <tbody>
            {methods.map((m, i) => {
              const env = m.method === "mpesa" && props.mpesaLive ? "production" : m.environment;
              return (
                <tr key={m.method}>
                  <td>
                    <span className={s.two}>
                      <span className={s.strong}>{INFO[m.method][0]}</span>
                      <span className={s.muted}>{INFO[m.method][1]}</span>
                    </span>
                  </td>
                  <td>
                    <span className={s.chip} data-tone={ENV[env][1] || undefined}>
                      {m.method === "mpesa" && props.mpesaLive ? "Ligado à Vodacom" : ENV[env][0]}
                    </span>
                  </td>
                  <td className={s.muted}>{m.note}</td>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={m.enabled}
                        aria-label={`${m.enabled ? "Desligar" : "Ligar"} ${INFO[m.method][0]}`}
                        className={s.switch}
                        onClick={() => {
                          setMethods(methods.map((x, j) => (j === i ? { ...x, enabled: !x.enabled } : x)));
                          touch();
                        }}
                      />
                      <span>{m.enabled ? "Activo" : "Desligado"}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={s.pager} style={{ flexWrap: "wrap", gap: 12 }}>
          <span>Moeda: Metical (MZN) · Formato: 52 000,00 MT</span>
          <span>Os métodos desligados deixam de aparecer no checkout de imediato. As chaves das operadoras e do banco ficam só no servidor.</span>
        </div>
      </section>

      <section className={s.card}>
        <h2 className={s.h2}>Avisos de novas compras</h2>
        <p className={s.muted}>Escolha quem é avisado e por onde. Cada pessoa recebe só os avisos da sua loja, se tiver uma loja escolhida.</p>
        <table className={s.table}>
          <thead>
            <tr>
              <th>Pessoa</th>
              <th colSpan={3}>Canais</th>
              <th>Recebe</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {recipients.map((r, i) => {
              const person = props.staff.find((p) => p.id === r.staffUserId);
              return (
                <tr key={r.staffUserId}>
                  <td>
                    <span className={s.two}>
                      <span className={s.strong}>{person?.name ?? "—"}</span>
                      <span className={s.muted}>{person?.role}</span>
                    </span>
                  </td>
                  {(["panel", "email", "whatsapp"] as const).map((k) => (
                    <td key={k}>
                      <label className={s.check}>
                        <input type="checkbox" checked={r[k]} onChange={() => flip(i, k)} />
                        {k === "panel" ? "Painel" : k === "email" ? "E-mail" : "WhatsApp"}
                      </label>
                    </td>
                  ))}
                  <td>
                    <select
                      className={s.select}
                      value={r.storeId ?? ""}
                      onChange={(e) => {
                        setRecipients(recipients.map((x, j) => (j === i ? { ...x, storeId: e.target.value || null } : x)));
                        touch();
                      }}
                      aria-label="Loja"
                    >
                      <option value="">Todas as compras</option>
                      {props.stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          Compras da Loja {st.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className={s.linkBtn}
                      onClick={() => {
                        setRecipients(recipients.filter((_, j) => j !== i));
                        touch();
                      }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className={s.actions}>
          <select className={s.select} style={{ width: "auto" }} value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Pessoa">
            <option value="">Escolher pessoa…</option>
            {props.staff
              .filter((p) => !recipients.some((r) => r.staffUserId === p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.role}
                </option>
              ))}
          </select>
          <button
            className={`${s.btnOutline} ${s.small}`}
            disabled={!adding}
            onClick={() => {
              setRecipients([...recipients, { staffUserId: adding, panel: true, email: true, whatsapp: false, storeId: null }]);
              setAdding("");
              touch();
            }}
          >
            <Icon name="plus" size={14} />
            Adicionar pessoa
          </button>
        </div>

        <div className={s.split2}>
          <div className={s.fieldset}>
            <span className={s.legend}>Mensagem de WhatsApp (pré-visualização)</span>
            <div className={s.pre}>
              {"Nova compra na Eterna · ET-2026-0148\n[Cliente] · 52 000,00 MT · M-Pesa (paga)\nLevantamento: Loja 02\nAbrir: eterna.co.mz/gestao/encomendas/…"}
            </div>
            <span className={s.hint}>O envio automático por WhatsApp e e-mail liga-se na fase 6. Até lá, os avisos aparecem no painel (contadores no menu).</span>
          </div>
          <fieldset className={s.fieldset}>
            <legend className={s.legend}>Enviar aviso quando</legend>
            {(Object.keys(EVENTS) as (keyof Events)[]).map((k) => (
              <label key={k} className={s.check}>
                <input
                  type="checkbox"
                  checked={events[k]}
                  onChange={() => {
                    setEvents({ ...events, [k]: !events[k] });
                    touch();
                  }}
                />
                {EVENTS[k]}
              </label>
            ))}
          </fieldset>
        </div>
      </section>
    </>
  );
}
