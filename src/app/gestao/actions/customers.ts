"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adjustPoints, importClients, notifyLevelUps, registerStorePurchase, setClientLevel, type ImportResult } from "@/server/admin/customers";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Gestão · Clientes" (design V3). Only roles that edit customers change levels and points; every change
 *     is in the audit log with the person's name.
 * PT: Acções de Clientes (V3). Só os papéis que editam clientes mudam níveis e pontos; tudo fica na auditoria.
 */

export type ClientActionResult = { ok: true; message: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): ClientActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar clientes." : e.message) : fallback,
});
const done = (message: string): ClientActionResult => {
  revalidatePath("/gestao/clientes");
  return { ok: true, message };
};

const levelSchema = z.object({ id: z.string().uuid(), level: z.enum(["rubi", "safira", "perola", "diamante"]), reason: z.string().trim().min(3).max(200) });

export async function setClientLevelAction(input: z.input<typeof levelSchema>): Promise<ClientActionResult> {
  try {
    const staff = await requireStaffAction("customers");
    const v = levelSchema.safeParse(input);
    if (!v.success) return { ok: false, message: "Escolha o nível e escreva o motivo." };
    await setClientLevel(staff, v.data.id, v.data.level, v.data.reason);
    return done("Nível guardado.");
  } catch (e) {
    return fail(e, "Não foi possível guardar o nível.");
  }
}

const storeSchema = z.object({ id: z.string().uuid(), amount: z.number().int().min(1000).max(100_000_000), store: z.string().min(1).max(10) });

export async function registerStorePurchaseAction(input: z.input<typeof storeSchema>): Promise<ClientActionResult> {
  try {
    const staff = await requireStaffAction("customers");
    const v = storeSchema.safeParse(input);
    if (!v.success) return { ok: false, message: "Escreva o valor da compra (pelo menos 1 000 MT) e escolha a loja." };
    const points = await registerStorePurchase(staff, v.data.id, v.data.amount, v.data.store);
    return done(`Venda associada · +${points} ${points === 1 ? "ponto" : "pontos"}.`);
  } catch (e) {
    return fail(e, "Não foi possível associar a venda.");
  }
}

const adjustSchema = z.object({ id: z.string().uuid(), points: z.number().int().min(-500).max(500).refine((n) => n !== 0), reason: z.string().trim().min(3).max(200) });

export async function adjustPointsAction(input: z.input<typeof adjustSchema>): Promise<ClientActionResult> {
  try {
    const staff = await requireStaffAction("customers");
    const v = adjustSchema.safeParse(input);
    if (!v.success) return { ok: false, message: "Escreva os pontos (ex.: + 5 ou − 3) e o motivo." };
    await adjustPoints(staff, v.data.id, v.data.points, v.data.reason);
    return done("Ajuste guardado.");
  } catch (e) {
    return fail(e, "Não foi possível guardar o ajuste.");
  }
}

export async function notifyLevelUpsAction(): Promise<ClientActionResult> {
  try {
    const staff = await requireStaffAction("customers");
    const sent = await notifyLevelUps(staff);
    return done(sent ? `${sent} ${sent === 1 ? "cliente avisada" : "clientes avisadas"} por WhatsApp.` : "Não há clientes com telefone a subir de nível.");
  } catch (e) {
    return fail(e, "Não foi possível enviar os avisos.");
  }
}

export async function importClientsAction(form: FormData): Promise<{ ok: true; result: ImportResult } | { ok: false; message: string }> {
  try {
    const staff = await requireStaffAction("customers");
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha o ficheiro Excel." };
    if (file.size > 10 * 1024 * 1024) return { ok: false, message: "O ficheiro tem mais de 10 MB." };
    const result = await importClients(staff, Buffer.from(await file.arrayBuffer()));
    revalidatePath("/gestao/clientes");
    return { ok: true, result };
  } catch (e) {
    const r = fail(e, "Não foi possível importar o ficheiro.");
    return { ok: false, message: r.message };
  }
}
