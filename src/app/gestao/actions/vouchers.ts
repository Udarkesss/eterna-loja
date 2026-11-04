"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createVoucher, resendVoucher, setDiscountDisplay, setDiscountKind, suggestCode } from "@/server/admin/vouchers";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Gestão · Descontos e vouchers" (design V3). Every change goes to the audit log.
 * PT: Acções de Descontos e vouchers (V3). Cada alteração fica no registo de auditoria.
 */

export type VoucherActionResult = { ok: true; message: string; code?: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): VoucherActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar descontos." : e.message) : fallback,
});
const refresh = () => {
  revalidatePath("/gestao/descontos");
  revalidatePath("/", "layout");
};

export async function setDiscountKindAction(kind: "level" | "campaigns" | "sale" | "vouchers", on: boolean): Promise<VoucherActionResult> {
  try {
    const staff = await requireStaffAction("discounts");
    if (!["level", "campaigns", "sale", "vouchers"].includes(kind)) return { ok: false, message: "Tipo desconhecido." };
    await setDiscountKind(staff, kind, on);
    refresh();
    return { ok: true, message: on ? "Ligado." : "Desligado." };
  } catch (e) {
    return fail(e, "Não foi possível guardar.");
  }
}

export async function setDiscountDisplayAction(display: "plain" | "named"): Promise<VoucherActionResult> {
  try {
    const staff = await requireStaffAction("discounts");
    if (display !== "plain" && display !== "named") return { ok: false, message: "Opção desconhecida." };
    await setDiscountDisplay(staff, display);
    refresh();
    return { ok: true, message: "Guardado." };
  } catch (e) {
    return fail(e, "Não foi possível guardar.");
  }
}

const voucherSchema = z
  .object({
    kind: z.enum(["fixed", "percent"]),
    value: z.number().int().min(1),
    minPurchase: z.number().int().min(0).nullable(),
    target: z.enum(["customer", "level", "all"]),
    customerId: z.string().uuid().nullable(),
    levelKey: z.string().nullable(),
    endsAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    maxUses: z.number().int().min(1).max(100_000).nullable(),
    code: z
      .string()
      .trim()
      .min(4)
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/),
    stacksWithLevel: z.boolean(),
    send: z.array(z.enum(["whatsapp", "email"])).max(2),
  })
  .refine((v) => v.kind === "fixed" || v.value <= 100, { path: ["value"] });

export async function createVoucherAction(input: z.input<typeof voucherSchema>): Promise<VoucherActionResult> {
  try {
    const staff = await requireStaffAction("discounts");
    const v = voucherSchema.safeParse(input);
    if (!v.success) {
      const field = v.error.issues[0]?.path[0];
      const msg: Record<string, string> = {
        value: "Escreva o valor (percentagem até 100).",
        code: "O código só pode ter letras, números e hífens (4 a 30).",
        endsAt: "Escolha a data de validade.",
        maxUses: "Escreva quantas vezes pode ser usado.",
      };
      return { ok: false, message: msg[String(field)] ?? "Verifique os dados do voucher." };
    }
    const r = await createVoucher(staff, v.data);
    refresh();
    return { ok: true, code: r.code, message: r.sent ? `Voucher ${r.code} gerado e enviado.` : `Voucher ${r.code} gerado. Já está na conta ${v.data.target === "customer" ? "da cliente" : "das clientes"}.` };
  } catch (e) {
    return fail(e, "Não foi possível gerar o voucher.");
  }
}

export async function resendVoucherAction(id: string): Promise<VoucherActionResult> {
  try {
    const staff = await requireStaffAction("discounts");
    const n = await resendVoucher(staff, id);
    return { ok: true, message: n > 1 ? "Reenviado por WhatsApp e e-mail." : "Reenviado." };
  } catch (e) {
    return fail(e, "Não foi possível reenviar.");
  }
}

/** EN: "Gerar outro": a fresh random code. PT: "Gerar outro": um código novo aleatório. */
export async function suggestCodeAction(name: string | null, kind: "fixed" | "percent", value: number): Promise<string> {
  await requireStaffAction("discounts");
  return suggestCode(name, kind, value, true);
}
