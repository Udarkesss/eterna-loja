"use server";

import { revalidatePath } from "next/cache";
import { updateOwnProfile } from "@/server/admin/staff";
import { finishDelivery, recordPosition, startDelivery } from "@/server/delivery";
import { changeStaffPassword } from "@/server/staff/auth";
import { AppError } from "@/server/errors";
import { currentStaff, type StaffContext } from "@/server/staff/access";

/**
 * EN: Driver app actions. Only the driver the delivery is assigned to can act on it (checked in src/server/delivery.ts).
 * PT: Acções da app do entregador. Só o entregador a quem a entrega foi atribuída pode mexer nela.
 */

export interface DriverResult {
  ok: boolean;
  message?: string;
}

async function driver(): Promise<StaffContext> {
  const staff = await currentStaff();
  if (!staff || staff.status === "temp_password") throw new AppError("UNAUTHORIZED", "SIGN_IN_REQUIRED", 401);
  return staff;
}

async function run(orderId: string, fn: (d: StaffContext) => Promise<unknown>): Promise<DriverResult> {
  try {
    await fn(await driver());
    revalidatePath(`/gestao/entregador/${orderId}`);
    revalidatePath("/gestao/entregador");
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "WRONG_CODE" ? "WRONG_CODE" : "Não foi possível. Tente outra vez." };
    throw e;
  }
}

export async function startDeliveryAction(orderId: string) {
  return run(orderId, (d) => startDelivery(d, orderId));
}

export async function finishDeliveryAction(orderId: string, code: string | null) {
  return run(orderId, (d) => finishDelivery(d, orderId, code));
}

/** EN: Called by the phone every ~15 s while in transit. PT: Chamado pelo telemóvel a cada ~15 s em trânsito. */
export async function positionAction(orderId: string, lat: number, lng: number) {
  try {
    await recordPosition(await driver(), orderId, lat, lng);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** EN: The driver edits their own WhatsApp and e-mail. PT: O entregador edita o seu WhatsApp e e-mail. */
export async function updateProfileAction(input: { phone: string; email: string; password: string }): Promise<DriverResult> {
  try {
    await updateOwnProfile(await driver(), input);
    revalidatePath("/gestao/entregador", "layout");
    return { ok: true, message: "Guardado. As entregas novas chegam a este número." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "SIGN_IN_REQUIRED" ? "A sessão terminou. Entre outra vez." : e.message };
    throw e;
  }
}

/** EN: The driver changes their password. PT: O entregador muda a palavra-passe. */
export async function changePasswordAction(input: { current: string; password: string; repeat: string }): Promise<DriverResult> {
  try {
    await changeStaffPassword((await driver()).id, input);
    return { ok: true, message: "Palavra-passe alterada." };
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    const map: Record<string, string> = {
      INVALID_CREDENTIALS: "A palavra-passe actual está errada.",
      PASSWORDS_DIFFER: "As duas palavras-passe novas não são iguais.",
      PASSWORD_TOO_SHORT: "A palavra-passe nova é curta demais.",
      PASSWORD_TOO_COMMON: "Essa palavra-passe é fácil de adivinhar. Escolha outra.",
    };
    return { ok: false, message: map[e.message] ?? "Não foi possível. Tente outra vez." };
  }
}
