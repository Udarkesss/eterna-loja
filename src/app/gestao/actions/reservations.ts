"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelReservation, completeReservation, createStoreReservation, extendReservation } from "@/server/admin/reservations";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Gestão · Reservas" (design V3). Every change goes to the audit log.
 * PT: Acções de Reservas (V3). Cada alteração fica no registo de auditoria.
 */

export type ReservationActionResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): ReservationActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar reservas." : e.message) : fallback,
});
const done = (message: string): ReservationActionResult => {
  revalidatePath("/gestao/reservas");
  revalidatePath("/gestao", "layout");
  return { ok: true, message };
};

const newSchema = z.object({
  customerId: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(20),
  variantId: z.string().uuid(),
  storeCode: z.string().min(1).max(5),
  deposit: z.number().int().min(1),
  method: z.enum(["cash", "mpesa", "emola", "mkesh", "card", "transfer"]),
  accepted: z.literal(true),
});

export async function createStoreReservationAction(input: z.input<typeof newSchema>): Promise<ReservationActionResult> {
  try {
    const staff = await requireStaffAction("reservations");
    const v = newSchema.safeParse(input);
    if (!v.success) {
      const field = String(v.error.issues[0]?.path[0]);
      const msg: Record<string, string> = {
        name: "Escreva o nome da cliente.",
        variantId: "Escolha a peça pelo código.",
        deposit: "Escreva o valor do sinal.",
        accepted: "Confirme que a cliente aceitou as condições de reserva.",
      };
      return { ok: false, message: msg[field] ?? "Verifique os dados da reserva." };
    }
    const number = await createStoreReservation(staff, v.data);
    return done(`Reserva ${number} registada.`);
  } catch (e) {
    return fail(e, "Não foi possível registar a reserva.");
  }
}

const id = z.string().uuid();

export async function extendReservationAction(reservationId: string): Promise<ReservationActionResult> {
  try {
    const staff = await requireStaffAction("reservations");
    await extendReservation(staff, id.parse(reservationId));
    return done("Reserva prolongada. A cliente foi avisada por WhatsApp.");
  } catch (e) {
    return fail(e, "Não foi possível prolongar.");
  }
}

export async function completeReservationAction(reservationId: string): Promise<ReservationActionResult> {
  try {
    const staff = await requireStaffAction("reservations");
    await completeReservation(staff, id.parse(reservationId));
    return done("Reserva concluída: peça levantada e paga.");
  } catch (e) {
    return fail(e, "Não foi possível concluir.");
  }
}

export async function cancelReservationAction(reservationId: string): Promise<ReservationActionResult> {
  try {
    const staff = await requireStaffAction("reservations");
    await cancelReservation(staff, id.parse(reservationId));
    return done("Reserva cancelada. A peça voltou à venda.");
  } catch (e) {
    return fail(e, "Não foi possível cancelar.");
  }
}
