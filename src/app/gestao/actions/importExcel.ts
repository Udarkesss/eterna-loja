"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/server/errors";
import { checkImport, runImport, type ImportCheck } from "@/server/import/excel";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Gestão · Importar" (Excel + ZIP, design V3). PT: Acções de Importar (Excel + ZIP, V3).
 */

type Fix = { row: number; field: string; value: string };

async function files(form: FormData) {
  const excel = form.get("excel");
  const zip = form.get("zip");
  if (!(excel instanceof File) || !excel.size) throw new AppError("VALIDATION_ERROR", "Escolha o Excel.", 400);
  if (excel.size > 10 * 1024 * 1024) throw new AppError("VALIDATION_ERROR", "O Excel tem mais de 10 MB.", 400);
  const fixes = JSON.parse(String(form.get("fixes") ?? "[]")) as Fix[];
  return { excel: Buffer.from(await excel.arrayBuffer()), zip: zip instanceof File && zip.size ? Buffer.from(await zip.arrayBuffer()) : null, fixes: Array.isArray(fixes) ? fixes.slice(0, 500) : [] };
}
const message = (e: unknown, fallback: string) => (e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite importar produtos." : e.message) : fallback);

export async function checkImportAction(form: FormData): Promise<{ ok: true; check: ImportCheck } | { ok: false; message: string }> {
  try {
    await requireStaffAction("products.publish");
    const f = await files(form);
    return { ok: true, check: await checkImport(f.excel, f.zip, f.fixes) };
  } catch (e) {
    return { ok: false, message: message(e, "Não foi possível ler os ficheiros.") };
  }
}

export async function runImportAction(form: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const staff = await requireStaffAction("products.publish");
    const f = await files(form);
    const mode = form.get("mode") === "publish" ? "publish" : "draft";
    const r = await runImport(staff, f.excel, f.zip, f.fixes, mode);
    revalidatePath("/gestao/produtos");
    revalidatePath("/", "layout");
    return { ok: true, message: `${r.created} ${r.created === 1 ? "produto novo" : "produtos novos"} · ${r.updated} ${r.updated === 1 ? "actualizado" : "actualizados"}${r.skipped ? ` · ${r.skipped} com erros ficaram de fora` : ""}.` };
  } catch (e) {
    return { ok: false, message: message(e, "Não foi possível importar.") };
  }
}
