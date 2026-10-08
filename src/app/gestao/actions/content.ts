"use server";

import { revalidatePath } from "next/cache";
import { publishPage, saveHero, saveTiles, type SectionSave, type TileSave } from "@/server/admin/content";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: Content actions (only roles with "content" access: Superadministrador and Administrador).
 * PT: Acções de conteúdo (só papéis com acesso a "content": Superadministrador e Administrador).
 */

export interface ContentResult {
  ok: boolean;
  message?: string;
  url?: string;
}

async function run(fn: () => Promise<unknown>, message: string): Promise<ContentResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export async function publishPageAction(page: "home" | "info", sections: SectionSave[]) {
  const staff = await requireStaffAction("content");
  return run(() => publishPage(staff, page, sections), "Página publicada.");
}

export async function saveTilesAction(tiles: TileSave[]) {
  const staff = await requireStaffAction("content");
  return run(() => saveTiles(staff, tiles), "Publicado.");
}

export async function saveHeroAction(patch: Record<string, unknown>) {
  const staff = await requireStaffAction("content");
  return run(() => saveHero(staff, patch), "Publicado.");
}

export async function uploadContentFileAction(form: FormData): Promise<ContentResult> {
  try {
    await requireStaffAction("content");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Escolha um ficheiro." };
    return { ok: true, url: await savePublicUpload(file, "content") };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}
