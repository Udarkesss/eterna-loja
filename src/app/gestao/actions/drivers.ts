"use server";

import { revalidatePath } from "next/cache";
import { acceptInvitation, activateDriver, checkInvitationCode, inviteDriver, resendInvite, setDriverActive, type InviteInput } from "@/server/admin/drivers";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Entregas · Entregadores (creating a driver account needs "users.staff") and the public invitation steps.
 * PT: Entregadores (criar a conta precisa de "users.staff") e os passos públicos do convite.
 */
type Result = { ok: boolean; message?: string; whatsappUrl?: string | null; code?: string };

async function run(fn: () => Promise<Partial<Result> | void>, message?: string): Promise<Result> {
  try {
    const r = await fn();
    revalidatePath("/gestao/entregas");
    return { ok: true, message, ...(r ?? {}) };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export async function inviteDriverAction(input: InviteInput) {
  const me = await requireStaffAction("users.staff");
  return run(() => inviteDriver(me, input), "Convite criado. Envie-o pelo WhatsApp.");
}

export async function resendInviteAction(id: string) {
  const me = await requireStaffAction("users.staff");
  return run(() => resendInvite(me, id), "Novo convite criado (48 horas).");
}

export async function setDriverActiveAction(id: string, active: boolean) {
  const me = await requireStaffAction("users.staff");
  return run(() => setDriverActive(me, id, active), active ? "Entregador activo." : "Entregador desactivado.");
}

// ── Public (no session): the invitation link is the proof. PT: Público: o link do convite é a prova. ──

export async function acceptInvitationAction(token: string) {
  return run(() => acceptInvitation(token));
}

export async function checkInvitationCodeAction(token: string, code: string) {
  return run(() => checkInvitationCode(token, code.replace(/\D/g, "").slice(0, 6)));
}

export async function activateDriverAction(token: string, code: string, password: string, repeat: string) {
  return run(() => activateDriver(token, code.replace(/\D/g, "").slice(0, 6), password, repeat));
}
