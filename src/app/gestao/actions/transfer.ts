"use server";

import { revalidatePath } from "next/cache";
import { receivePart, receivePhoto, type TransferPart } from "@/server/admin/transfer";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: "Trazer os dados do computador" (super administrator only, checked again in src/server/admin/transfer.ts).
 * PT: "Trazer os dados do computador" (só o superadministrador, verificado também em src/server/admin/transfer.ts).
 */

export type TransferResult = { ok: true; url?: string; count?: number } | { ok: false; message: string };

const fail = (e: unknown): TransferResult => {
  if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "Só o superadministrador pode trazer os dados." : e.message };
  return { ok: false, message: e instanceof Error ? e.message : "Erro desconhecido." };
};

export async function transferPhotoAction(form: FormData): Promise<TransferResult> {
  try {
    const staff = await requireStaffAction("system");
    const file = form.get("file");
    const path = form.get("path");
    if (!(file instanceof File) || typeof path !== "string") return { ok: false, message: "Foto em falta." };
    return { ok: true, url: await receivePhoto(staff, path, Buffer.from(await file.arrayBuffer()), file.type) };
  } catch (e) {
    return fail(e);
  }
}

export async function transferPartAction(json: string): Promise<TransferResult> {
  try {
    const staff = await requireStaffAction("system");
    const count = await receivePart(staff, JSON.parse(json) as TransferPart);
    if (JSON.parse(json).part === "done") revalidatePath("/", "layout");
    return { ok: true, count };
  } catch (e) {
    return fail(e);
  }
}
