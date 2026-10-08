"use server";

import { revalidatePath } from "next/cache";
import type { FulfillmentStatus } from "@/types";
import {
  approveRefund,
  assignDriver,
  cancelOrder,
  checkWithOperator,
  confirmCashReceived,
  registerRefund,
  reviewTransfer,
  saveInternalNotes,
  setFulfillment,
} from "@/server/admin/orders";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Order actions of "Gestão · 3 Detalhe da encomenda". Each one checks the person's access on the server.
 * PT: Acções do detalhe da encomenda. Cada uma verifica o acesso da pessoa no servidor.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

const MESSAGES: Record<string, string> = {
  NO_ACCESS: "O seu papel não permite esta acção.",
  OTHER_STORE: "Esta encomenda é de outra loja.",
  "Payment not confirmed": "O pagamento ainda não está confirmado.",
  "Paid: register a refund instead": "A encomenda está paga: registe uma devolução em vez de cancelar.",
  "Invalid amount": "Valor inválido.",
};

async function run(id: string, fn: () => Promise<unknown>, ok?: string): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath(`/gestao/encomendas/${id}`);
    revalidatePath("/gestao", "layout");
    return { ok: true, message: ok };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: MESSAGES[e.message] ?? e.message };
    throw e;
  }
}

export async function fulfillmentAction(id: string, status: FulfillmentStatus) {
  const staff = await requireStaffAction("orders.edit");
  return run(id, () => setFulfillment(staff, id, status));
}

export async function transferAction(id: string, approve: boolean) {
  const staff = await requireStaffAction("transfers.validate");
  return run(id, () => reviewTransfer(staff, id, approve), approve ? "Comprovativo validado. A encomenda está paga." : "Comprovativo recusado. As peças voltaram ao stock.");
}

export async function cashAction(id: string) {
  const staff = await requireStaffAction("orders.edit");
  return run(id, () => confirmCashReceived(staff, id), "Pagamento registado.");
}

export async function operatorAction(id: string): Promise<ActionResult> {
  const staff = await requireStaffAction("orders.view", "view");
  let state = "";
  const r = await run(id, async () => {
    const status = await checkWithOperator(staff, id);
    state = status?.paymentStatus ?? "";
  });
  const label: Record<string, string> = { pending: "ainda pendente", paid: "paga", failed: "recusada", expired: "expirada", refunded: "reembolsada" };
  return r.ok ? { ok: true, message: `Estado na operadora: ${label[state] ?? state}.` } : r;
}

export async function cancelAction(id: string) {
  const staff = await requireStaffAction("orders.cancel");
  return run(id, () => cancelOrder(staff, id), "Encomenda cancelada.");
}

export async function refundAction(id: string, amount: number, reason: string) {
  const staff = await requireStaffAction("refunds");
  return run(id, () => registerRefund(staff, id, amount, reason), "Devolução registada.");
}

export async function approveRefundAction(orderId: string, refundId: string) {
  const staff = await requireStaffAction("refunds");
  return run(orderId, () => approveRefund(staff, refundId), "Devolução aprovada.");
}

export async function notesAction(id: string, notes: string) {
  const staff = await requireStaffAction("orders.edit");
  return run(id, () => saveInternalNotes(staff, id, notes), "Nota guardada.");
}

export async function driverAction(id: string, driverId: string | null) {
  const staff = await requireStaffAction("deliveries.assign");
  return run(id, () => assignDriver(staff, id, driverId), "Entregador atribuído.");
}
