"use client";

import { useState, useTransition } from "react";
import {
  approveRefundAction,
  cancelAction,
  cashAction,
  driverAction,
  fulfillmentAction,
  notesAction,
  operatorAction,
  refundAction,
  transferAction,
  type ActionResult,
} from "@/app/gestao/actions/orders";
import type { FulfillmentStatus, FulfillmentType, PaymentMethod, PaymentStatus } from "@/types";
import s from "./admin.module.css";

/**
 * EN: "Próximo passo" box: shows only the next sensible action for the order's state
 *     (validate proof → mark ready → confirm pickup; or assign driver → in transit → delivered).
 * PT: Caixa "Próximo passo": mostra só a acção seguinte que faz sentido para o estado da encomenda.
 */

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  const feedback = result?.message ? <div className={result.ok ? s.notice : s.error}>{result.message}</div> : null;
  return { pending, run, feedback };
}

interface OrderInfo {
  id: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  fulfillmentType: FulfillmentType;
  fulfillmentStatus: FulfillmentStatus;
  hasProof: boolean;
  storeLabel: string;
  driverId: string | null;
  deliveryCode: string | null;
}

export function OrderActions({
  order: o,
  drivers,
  can,
}: {
  order: OrderInfo;
  drivers: { id: string; name: string }[];
  can: { edit: boolean; validate: boolean; cancel: boolean; assign: boolean };
}) {
  const { pending, run, feedback } = useAction();
  const paidOrCod = o.paymentStatus === "paid" || (o.paymentMethod === "cod" && o.paymentStatus === "pending");
  const mobile = ["mpesa", "emola", "mkesh", "card"].includes(o.paymentMethod);

  const steps: React.ReactNode[] = [];

  if (o.paymentStatus === "pending" && o.paymentMethod === "transfer") {
    steps.push(
      <div key="transfer" className={s.fieldset}>
        <span className={s.muted}>
          {o.hasProof ? "Confirme que o valor entrou na conta da Eterna antes de validar." : "A cliente ainda não enviou o comprovativo. As peças ficam reservadas até ao fim do prazo."}
        </span>
        {can.validate && o.hasProof && (
          <div className={s.actions}>
            <button className={s.btn} disabled={pending} onClick={() => run(() => transferAction(o.id, true))}>
              Validar comprovativo
            </button>
            <button className={s.btnDanger} disabled={pending} onClick={() => run(() => transferAction(o.id, false))}>
              Recusar
            </button>
          </div>
        )}
      </div>,
    );
  }

  if (o.paymentStatus === "pending" && mobile) {
    steps.push(
      <div key="operator" className={s.fieldset}>
        <span className={s.muted}>A aguardar confirmação da cliente no telemóvel.</span>
        <button className={s.btnOutline} disabled={pending} onClick={() => run(() => operatorAction(o.id))}>
          Verificar estado na operadora
        </button>
      </div>,
    );
  }

  if (paidOrCod && o.fulfillmentType === "pickup" && can.edit) {
    if (o.fulfillmentStatus === "pending") {
      steps.push(
        <div key="ready" className={s.fieldset}>
          <span className={s.muted}>Prepare as peças na {o.storeLabel}. Ao marcar como pronta, a cliente é avisada por SMS.</span>
          <button className={s.btn} disabled={pending} onClick={() => run(() => fulfillmentAction(o.id, "ready"))}>
            Marcar como pronta
          </button>
        </div>,
      );
    } else if (o.fulfillmentStatus === "ready") {
      steps.push(
        <div key="collected" className={s.fieldset}>
          <div className={s.notice}>Pronta para levantamento. A cliente foi avisada.</div>
          <button className={s.btn} disabled={pending} onClick={() => run(() => fulfillmentAction(o.id, "collected"))}>
            Confirmar levantamento
          </button>
        </div>,
      );
    } else if (o.fulfillmentStatus === "collected") {
      steps.push(
        <div key="done" className={s.notice}>
          Levantada pela cliente. Encomenda concluída.
        </div>,
      );
    }
  }

  if (paidOrCod && o.fulfillmentType === "delivery") {
    if (can.assign && ["pending", "assigned"].includes(o.fulfillmentStatus)) {
      steps.push(
        <label key="driver" className={s.label}>
          Entregador
          <select
            className={s.select}
            defaultValue={o.driverId ?? ""}
            disabled={pending}
            onChange={(e) => run(() => driverAction(o.id, e.target.value || null))}
          >
            <option value="">— Por atribuir —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className={s.hint}>O acompanhamento com GPS e a app do entregador chegam na fase 5.</span>
        </label>,
      );
    }
    if (can.edit && o.fulfillmentStatus === "assigned") {
      steps.push(
        <button key="transit" className={s.btn} disabled={pending} onClick={() => run(() => fulfillmentAction(o.id, "in_transit"))}>
          Saiu para entrega
        </button>,
      );
    }
    if (can.edit && o.fulfillmentStatus === "in_transit") {
      steps.push(
        <div key="delivered" className={s.fieldset}>
          <span className={s.muted}>Confirme com o código de recepção da cliente{o.deliveryCode ? ` (${o.deliveryCode})` : ""}.</span>
          <button className={s.btn} disabled={pending} onClick={() => run(() => fulfillmentAction(o.id, "delivered"))}>
            Marcar como entregue
          </button>
        </div>,
      );
    }
    if (o.paymentMethod === "cod" && o.paymentStatus === "pending" && can.edit && ["in_transit", "delivered"].includes(o.fulfillmentStatus)) {
      steps.push(
        <button key="cash" className={s.btnOutline} disabled={pending} onClick={() => run(() => cashAction(o.id))}>
          Dinheiro recebido
        </button>,
      );
    }
    if (o.fulfillmentStatus === "delivered" || o.fulfillmentStatus === "confirmed") {
      steps.push(
        <div key="d" className={s.notice}>
          Entregue à cliente.
        </div>,
      );
    }
  }

  if (["failed", "expired"].includes(o.paymentStatus)) {
    steps.push(
      <div key="f" className={s.muted}>
        O pagamento não foi concluído e as peças voltaram ao stock. Nada a fazer.
      </div>,
    );
  }

  const cancellable = can.cancel && o.paymentStatus === "pending" && o.fulfillmentStatus !== "cancelled";

  return (
    <div className={s.fieldset} style={{ gap: 14 }}>
      {feedback}
      {steps.length ? steps : <span className={s.muted}>Sem acções pendentes.</span>}
      {cancellable && (
        <button
          className={`${s.linkBtn}`}
          style={{ alignSelf: "flex-start", color: "var(--danger)" }}
          disabled={pending}
          onClick={() => {
            if (window.confirm("Cancelar esta encomenda? As peças voltam ao stock.")) run(() => cancelAction(o.id));
          }}
        >
          Cancelar encomenda
        </button>
      )}
    </div>
  );
}

export function OrderNotes({ orderId, initial, canEdit }: { orderId: string; initial: string; canEdit: boolean }) {
  const { pending, run, feedback } = useAction();
  const [notes, setNotes] = useState(initial);
  return (
    <div className={s.fieldset}>
      {feedback}
      <label className={s.label}>
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Nota interna</span>
        <textarea className={s.textarea} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={!canEdit} placeholder="Só a equipa vê. Ex.: cliente pediu ajuste na bainha." />
      </label>
      {canEdit && (
        <button className={`${s.btnOutline} ${s.small}`} style={{ alignSelf: "flex-start" }} disabled={pending || notes === initial} onClick={() => run(() => notesAction(orderId, notes))}>
          Guardar nota
        </button>
      )}
    </div>
  );
}

export function OrderRefunds({
  orderId,
  total,
  refunds,
  canRequest,
  canApprove,
  needsApproval,
}: {
  orderId: string;
  total: number;
  refunds: { id: string; amount: number; reason: string | null; status: string; at: string }[];
  canRequest: boolean;
  canApprove: boolean;
  needsApproval: boolean;
}) {
  const { pending, run, feedback } = useAction();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(total));
  const [reason, setReason] = useState("");
  const STATUS: Record<string, string> = { requested: "A aguardar aprovação", approved: "Aprovada", rejected: "Recusada" };

  return (
    <div className={s.fieldset}>
      {feedback}
      {refunds.map((r) => (
        <div key={r.id} className={s.warning} style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span>
            Devolução de {r.amount.toLocaleString("pt-PT")} MT · {STATUS[r.status]} · {r.at}
            {r.reason ? ` · ${r.reason}` : ""}
          </span>
          {r.status === "requested" && canApprove && (
            <button className={`${s.btn} ${s.small}`} disabled={pending} onClick={() => run(() => approveRefundAction(orderId, r.id))}>
              Aprovar
            </button>
          )}
        </div>
      ))}
      {canRequest && !open && (
        <div className={s.actions}>
          <button className={s.btnOutline} onClick={() => setOpen(true)}>
            Registar devolução
          </button>
        </div>
      )}
      {open && (
        <div className={s.fieldset} style={{ padding: 16, border: "1px solid var(--line)", background: "var(--ivory)" }}>
          <div className={s.row2}>
            <label className={s.label}>
              Valor (MT)
              <input className={s.input} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className={s.label}>
              Motivo
              <input className={s.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: tamanho errado" />
            </label>
          </div>
          {needsApproval && <span className={s.hint}>Como Gestora de loja, a devolução fica a aguardar aprovação de um Administrador.</span>}
          <div className={s.actions}>
            <button
              className={s.btn}
              disabled={pending || !Number(amount)}
              onClick={() =>
                run(async () => {
                  const r = await refundAction(orderId, Number(amount), reason);
                  if (r.ok) setOpen(false);
                  return r;
                })
              }
            >
              {needsApproval ? "Pedir aprovação" : "Registar"}
            </button>
            <button className={s.btnOutline} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
