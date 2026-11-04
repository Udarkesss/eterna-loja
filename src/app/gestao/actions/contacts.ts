"use server";

import { revalidatePath } from "next/cache";
import { publishContacts } from "@/server/admin/contacts";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";
import { savePublicUpload } from "@/server/uploads";

/** EN: "Contactos e redes sociais" (content access). PT: Contactos e redes sociais (acesso a conteúdo). */
export async function publishContactsAction(input: { stores: unknown; contacts: unknown }): Promise<{ ok: boolean; message?: string }> {
  try {
    const staff = await requireStaffAction("content");
    await publishContacts(staff, input);
    revalidatePath("/", "layout");
    return { ok: true, message: "Alterações publicadas." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

/** EN: Store photo or a network icon. PT: Foto da loja ou ícone de uma rede. */
export async function uploadContactImageAction(form: FormData): Promise<{ ok: boolean; url?: string; message?: string }> {
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
