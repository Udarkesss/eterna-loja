"use server";

import { revalidatePath } from "next/cache";
import { createStaff, deleteStaff, endSessions, newTemporaryPassword, setSuspended, updateStaff, type StaffInput } from "@/server/admin/staff";
import { saveMatrix } from "@/server/admin/roles";
import { AppError } from "@/server/errors";
import { currentStaff, type StaffContext } from "@/server/staff/access";

/**
 * EN: Staff and role actions. Who may do what is decided in src/server/admin/staff.ts (never in the browser).
 * PT: Acções de utilizadores e papéis. Quem pode fazer o quê decide-se no servidor.
 */

export interface StaffResult {
  ok: boolean;
  message?: string;
  password?: string;
  text?: string;
  whatsappUrl?: string | null;
}

async function me(): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff || staff.status === "temp_password") throw new AppError("UNAUTHORIZED", "SIGN_IN_REQUIRED", 401);
  return staff;
}

async function run(fn: (s: StaffContext) => Promise<Partial<StaffResult> | void>, message: string): Promise<StaffResult> {
  try {
    const extra = (await fn(await me())) ?? {};
    revalidatePath("/gestao", "layout");
    return { ok: true, message, ...extra };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export const createStaffAction = async (input: StaffInput) =>
  run(async (s) => {
    const r = await createStaff(s, input);
    return { password: r.password, text: r.message, whatsappUrl: r.whatsappUrl };
  }, "Utilizador criado. Palavra-passe temporária pronta a enviar.");

export const suspendStaffAction = async (id: string, suspended: boolean) => run((s) => setSuspended(s, id, suspended), suspended ? "Utilizador suspenso." : "Utilizador reactivado.");

export const resetStaffPasswordAction = async (id: string) =>
  run(async (s) => {
    const r = await newTemporaryPassword(s, id);
    return { password: r.password, whatsappUrl: r.whatsappUrl };
  }, "Nova palavra-passe temporária criada.");

export const endSessionsAction = async (id: string) => run((s) => endSessions(s, id), "Sessões terminadas.");
export const deleteStaffAction = async (id: string) => run((s) => deleteStaff(s, id), "Utilizador apagado.");
export const updateStaffAction = async (id: string, input: { name: string; email: string; storeCodes: string[] }) => run((s) => updateStaff(s, id, input), "Alterações guardadas.");
export const saveMatrixAction = async (matrix: Record<string, Record<string, string>>) => run((s) => saveMatrix(s, matrix), "Guardado e registado na auditoria.");
