"use server";

import { revalidatePath } from "next/cache";
import { FRAME_DEFAULT, type Frame } from "@/data/framing";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { getFraming, saveFrame } from "@/server/framing";
import { canEdit, currentStaff } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/**
 * EN: "Enquadrar" (design V3-G-Enquadrar), opened from products, types, collections, campaigns and site content: anyone
 *     who can change one of those can frame the file.
 * PT: "Enquadrar", aberto a partir de produtos, tipos, colecções, campanhas e conteúdo: quem pode alterar um destes pode
 *     enquadrar o ficheiro.
 */
const AREAS = ["content", "products.edit", "products.publish"];

async function staffWhoFrames() {
  const staff = await currentStaff();
  if (!staff || staff.status === "temp_password" || !AREAS.some((a) => canEdit(staff, a))) throw new AppError("FORBIDDEN", "O seu papel não permite esta acção.", 403);
  return staff;
}

export async function getFrameAction(url: string): Promise<Frame> {
  await staffWhoFrames();
  return (await getFraming())[url] ?? FRAME_DEFAULT;
}

export async function saveFrameAction(url: string, frame: Frame): Promise<{ ok: boolean; message?: string }> {
  try {
    const staff = await staffWhoFrames();
    await saveFrame(url, frame, staff.id);
    await audit({ actor: { type: "staff", id: staff.id, name: staff.name, role: staff.roleName }, action: "Enquadramento guardado", detail: url.split("/").pop() ?? url });
    revalidatePath("/", "layout");
    return { ok: true, message: "Enquadramento guardado." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}

/** EN: The chosen video frame as an image (cover). PT: O fotograma escolhido como imagem de capa. */
export async function uploadPosterAction(form: FormData): Promise<{ ok: boolean; url?: string; message?: string }> {
  try {
    await staffWhoFrames();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return { ok: false, message: "Sem imagem." };
    return { ok: true, url: await savePublicUpload(file, "content") };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}
