"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createType, deleteType, renameType, saveTypeOrder, setShowIn, setTypeImage } from "@/server/admin/types";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: Actions of "Gestão · Tipos de peça" (design V3). PT: Acções de Tipos de peça (V3).
 */

export type TypeActionResult = { ok: true; message: string; url?: string } | { ok: false; message: string };

const fail = (e: unknown, fallback: string): TypeActionResult => ({
  ok: false,
  message: e instanceof AppError ? (e.message === "NO_ACCESS" ? "O seu papel não permite alterar tipos de peça." : e.message) : fallback,
});
const done = (message: string, url?: string): TypeActionResult => {
  revalidatePath("/gestao/tipos");
  revalidatePath("/", "layout");
  return { ok: true, message, url };
};
const uuid = z.string().uuid();

export async function saveTypeOrderAction(ids: string[]): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await saveTypeOrder(staff, z.array(uuid).max(200).parse(ids));
    return done("Ordem guardada.");
  } catch (e) {
    return fail(e, "Não foi possível guardar a ordem.");
  }
}

export async function renameTypeAction(id: string, name: string): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const clean = z.string().trim().min(2).max(60).safeParse(name);
    if (!clean.success) return { ok: false, message: "Escreva o nome (2 a 60 letras)." };
    await renameType(staff, uuid.parse(id), clean.data, null);
    return done("Nome guardado.");
  } catch (e) {
    return fail(e, "Não foi possível guardar o nome.");
  }
}

export async function uploadTypeImageAction(id: string, form: FormData): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Escolha uma imagem." };
    const url = await savePublicUpload(file, "content");
    if (id) await setTypeImage(staff, uuid.parse(id), url);
    return done("Imagem guardada.", url);
  } catch (e) {
    return fail(e, "Não foi possível guardar a imagem.");
  }
}

export async function setShowInAction(id: string, showIn: "noivas" | "acessorios" | "both"): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await setShowIn(staff, uuid.parse(id), z.enum(["noivas", "acessorios", "both"]).parse(showIn));
    return done("Guardado.");
  } catch (e) {
    return fail(e, "Não foi possível guardar.");
  }
}

export async function deleteTypeAction(id: string): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    await deleteType(staff, uuid.parse(id));
    return done("Tipo removido.");
  } catch (e) {
    return fail(e, "Não foi possível remover.");
  }
}

export async function createTypeAction(input: { name: string; groupId: string; imageUrl: string | null }): Promise<TypeActionResult> {
  try {
    const staff = await requireStaffAction("products.publish");
    const v = z.object({ name: z.string().trim().min(2).max(60), groupId: uuid, imageUrl: z.string().max(500).nullable() }).safeParse(input);
    if (!v.success) return { ok: false, message: "Escreva o nome e escolha o grupo." };
    await createType(staff, { ...v.data, nameEn: null });
    return done(`Tipo “${v.data.name}” criado.`);
  } catch (e) {
    return fail(e, "Não foi possível criar o tipo.");
  }
}
