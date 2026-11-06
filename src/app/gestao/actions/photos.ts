"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/server/errors";
import { auditPhotoImport, commitPhotos, planInputSchema, planPhotoImport, readTables, savePhoto, type CommitInput, type PhotoGroup, type PhotoPlan, type TableRow } from "@/server/import/photos";
import { requireStaffAction } from "@/server/staff/access";

/**
 * EN: Actions of "Importar fotos de uma pasta" (src/server/import/photos.ts). Only people who edit products.
 * PT: Acções de "Importar fotos de uma pasta". Só quem edita produtos.
 */

const message = (e: unknown, fallback: string) =>
  e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite importar fotos." : e.message) : fallback;

export async function planPhotoImportAction(groups: PhotoGroup[]): Promise<{ ok: true; plan: PhotoPlan } | { ok: false; message: string }> {
  try {
    await requireStaffAction("products.edit");
    return { ok: true, plan: await planPhotoImport(planInputSchema.parse(groups)) };
  } catch (e) {
    return { ok: false, message: message(e, "Não foi possível ler a lista de fotos.") };
  }
}

/** EN: Reads one Word table of the folder "Tabelas". PT: Lê uma tabela Word da pasta "Tabelas". */
export async function readTablesAction(form: FormData): Promise<{ ok: true; rows: TableRow[] } | { ok: false; message: string }> {
  try {
    await requireStaffAction("products.edit");
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 900_000) throw new AppError("VALIDATION_ERROR", "Tabela inválida ou grande demais.", 400);
    return { ok: true, rows: readTables(Buffer.from(await file.arrayBuffer())) };
  } catch (e) {
    return { ok: false, message: message(e, "Não foi possível ler esta tabela.") };
  }
}

export async function uploadImportPhotoAction(form: FormData): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  try {
    await requireStaffAction("products.edit");
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Falta a foto.", 400);
    return { ok: true, url: await savePhoto(String(form.get("code") ?? "").toUpperCase(), String(form.get("source") ?? ""), file) };
  } catch (e) {
    return { ok: false, message: message(e, "A foto não foi guardada.") };
  }
}

export async function commitImportPhotosAction(input: CommitInput): Promise<{ ok: true; result: "replaced" | "created" } | { ok: false; message: string }> {
  try {
    const staff = await requireStaffAction("products.edit");
    return { ok: true, result: await commitPhotos(staff, input) };
  } catch (e) {
    return { ok: false, message: message(e, "As fotos deste produto não foram gravadas.") };
  }
}

export async function finishPhotoImportAction(summary: string): Promise<void> {
  const staff = await requireStaffAction("products.edit");
  await auditPhotoImport(staff, summary);
  revalidatePath("/gestao/produtos");
  revalidatePath("/", "layout");
}
