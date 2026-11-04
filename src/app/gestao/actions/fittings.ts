"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeMsisdn } from "@/lib/payments/msisdn";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import {
  confirmationMessage,
  createFittingByStaff,
  customerWhatsapp,
  getFitting,
  proposalMessage,
  rescheduleFitting,
  setFittingStatus,
  updateFittingNotes,
} from "@/server/fittings";
import { accessOf, assertStoreAllowed, requireStaffAction, type StaffContext } from "@/server/staff/access";
import { setSetting } from "@/server/settings";
import { FITTING_KINDS, type FittingKind, type FittingStatus } from "@/types";

/**
 * EN: Actions of "Gestão · 5 Provas". After "Aceitar" / "Propor outra hora" the result carries the WhatsApp link with
 *     the message already written, so the team only presses send.
 * PT: Acções das Provas. Depois de "Aceitar" / "Propor outra hora" o resultado traz o link do WhatsApp com a mensagem
 *     já escrita: a equipa só carrega em enviar.
 */

export interface FittingActionResult {
  ok: boolean;
  message?: string;
  whatsappUrl?: string;
}

const MESSAGES: Record<string, string> = {
  "Slot taken": "Essa hora já está ocupada nesta loja.",
  NO_ACCESS: "O seu papel não permite esta acção.",
  OTHER_STORE: "Esta prova é de outra loja.",
};

const actor = (s: StaffContext) => ({ type: "staff" as const, id: s.id, name: s.name, role: s.roleName });

async function load(staff: StaffContext, id: string) {
  const data = await getFitting(id);
  assertStoreAllowed(staff, "fittings", data.fitting.storeId);
  return data;
}

async function run(fn: () => Promise<FittingActionResult>): Promise<FittingActionResult> {
  try {
    const r = await fn();
    revalidatePath("/gestao", "layout");
    return r;
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: MESSAGES[e.message] ?? e.message };
    throw e;
  }
}

const text = (max: number) => z.object({ pt: z.string().trim().max(max), en: z.string().trim().max(max) });
const time = z.string().regex(/^\d{2}:\d{2}$/);

/** EN: What "Pacotes e regras" may save (design V3). PT: O que "Pacotes e regras" pode guardar. */
const bridalSchema = z.object({
  enabled: z.boolean(),
  packages: z
    .array(
      z.object({
        key: z.string().trim().regex(/^[a-z0-9-]{1,20}$/),
        name: z.string().trim().min(1).max(30),
        dresses: z.number().int().min(1).max(20),
        minutes: z.number().int().min(15).max(480),
        price: z.number().int().min(0).max(1_000_000),
        includes: text(160),
        status: z.enum(["active", "soon", "off"]),
      }),
    )
    .min(1)
    .max(6),
  extraMax: z.number().int().min(0).max(10),
  extraPrice: z.number().int().min(0).max(100_000),
  discountDays: z.number().int().min(0).max(365),
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  hours: z.array(time).min(1).max(12),
  advanceHours: z.number().int().min(0).max(720),
  cancelHours: z.number().int().min(0).max(720),
  companions: z.number().int().min(0).max(10),
  noShowFee: z.boolean(),
  requireTerms: z.boolean(),
  termsUrl: z.string().max(500).nullable(),
});

/** EN: Saves "Provas ligadas", packages and rules. PT: Guarda "Provas ligadas", pacotes e regras. */
export async function saveBridalSettingsAction(input: unknown): Promise<FittingActionResult> {
  const staff = await requireStaffAction("fittings");
  if (accessOf(staff, "fittings") !== "T") return { ok: false, message: MESSAGES.NO_ACCESS };
  const parsed = bridalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Verifique os valores dos pacotes e das regras." };
  const value = { ...parsed.data, hours: [...new Set(parsed.data.hours)].sort(), days: [...new Set(parsed.data.days)].sort() };
  await setSetting("fittings.bridal", value, staff.id);
  await audit({ actor: actor(staff), action: "Provas · pacotes e regras guardados", detail: value.enabled ? "Provas ligadas" : "Provas desligadas" });
  revalidatePath("/gestao/provas");
  return { ok: true, message: "Guardado." };
}

const LABEL: Partial<Record<FittingStatus, string>> = {
  confirmed: "Prova confirmada",
  done: "Prova marcada como realizada",
  no_show: "Prova marcada como falta",
  cancelled: "Prova cancelada",
};

export async function fittingStatusAction(id: string, status: FittingStatus): Promise<FittingActionResult> {
  const staff = await requireStaffAction("fittings");
  return run(async () => {
    const { fitting, store } = await load(staff, id);
    const row = await setFittingStatus(id, status, staff.id);
    await audit({ actor: actor(staff), action: LABEL[status] ?? `Prova: ${status}`, detail: `${fitting.code} · Loja ${store.code}` });
    return {
      ok: true,
      message: status === "confirmed" ? "Confirmada. Envie a confirmação à cliente pelo WhatsApp." : LABEL[status],
      whatsappUrl: status === "confirmed" ? customerWhatsapp(row.phone, confirmationMessage(row, store)) : undefined,
    };
  });
}

export async function proposeTimeAction(id: string, date: string, time: string): Promise<FittingActionResult> {
  const staff = await requireStaffAction("fittings");
  return run(async () => {
    const { fitting, store } = await load(staff, id);
    const row = await rescheduleFitting(id, date, time);
    await audit({ actor: actor(staff), action: "Outra hora proposta", detail: `${fitting.code} → ${date} ${time}` });
    return { ok: true, message: "Nova hora guardada como “Por confirmar”. Envie a proposta à cliente.", whatsappUrl: customerWhatsapp(row.phone, proposalMessage(row, store)) };
  });
}

export async function fittingNotesAction(id: string, notes: string): Promise<FittingActionResult> {
  const staff = await requireStaffAction("fittings");
  return run(async () => {
    await load(staff, id);
    await updateFittingNotes(id, notes.slice(0, 1000));
    return { ok: true, message: "Nota guardada." };
  });
}

export async function newFittingAction(form: FormData): Promise<FittingActionResult> {
  const staff = await requireStaffAction("fittings");
  return run(async () => {
    const phone = normalizeMsisdn(String(form.get("phone") ?? ""));
    const kind = String(form.get("kind")) as FittingKind;
    const name = String(form.get("name") ?? "").trim();
    const date = String(form.get("date") ?? "");
    const time = String(form.get("time") ?? "");
    const storeCode = String(form.get("store") ?? "");
    if (!phone) return { ok: false, message: "Número de telefone inválido." };
    if (accessOf(staff, "fittings") === "L" && !staff.storeCodes.includes(storeCode)) return { ok: false, message: MESSAGES.OTHER_STORE };
    if (!FITTING_KINDS.includes(kind) || name.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return { ok: false, message: "Preencha nome, tipo, dia e hora." };
    }
    const row = await createFittingByStaff(
      {
        name,
        phone,
        kind,
        storeCode,
        date,
        time,
        notes: String(form.get("notes") ?? ""),
        source: form.get("source") === "store" ? "store" : "whatsapp",
        locale: "pt",
        packageKey: String(form.get("package") ?? "") || undefined,
        extras: Number(form.get("extras") ?? 0) || 0,
      },
      staff.id,
    );
    const { store } = await load(staff, row.id);
    await audit({ actor: actor(staff), action: "Prova criada", detail: `${row.code} · Loja ${store.code} · ${date} ${time}` });
    return { ok: true, message: `Prova ${row.code} criada e confirmada.`, whatsappUrl: customerWhatsapp(row.phone, confirmationMessage(row, store)) };
  });
}
