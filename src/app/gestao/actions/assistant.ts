"use server";

import { revalidatePath } from "next/cache";
import { saveAssistant } from "@/server/admin/assistant";
import { closeConversation, teamReply } from "@/server/assistant/chat";
import { AppError } from "@/server/errors";
import { requireStaffAction } from "@/server/staff/access";

/** EN: Gestão → Assistente (content access: Superadministrador and Administrador). PT: Só quem tem acesso a conteúdo. */
type Result = { ok: boolean; message?: string; whatsappUrl?: string };

async function run(fn: () => Promise<Result | void>, message: string): Promise<Result> {
  try {
    const r = await fn();
    revalidatePath("/", "layout");
    return r ?? { ok: true, message };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message === "NO_ACCESS" ? "O seu papel não permite esta acção." : e.message };
    throw e;
  }
}

export async function saveAssistantAction(settings: unknown) {
  const staff = await requireStaffAction("content");
  return run(() => saveAssistant(staff, settings), "Guardado.");
}

export async function replyChatAction(conversationId: string, text: string) {
  const staff = await requireStaffAction("content");
  const body = text.trim().slice(0, 2000);
  if (!body) return { ok: false, message: "Escreva a resposta." };
  return run(async () => {
    const r = await teamReply(conversationId, body, staff.id);
    if (r.whatsappUrl) return { ok: true, message: "Abra o WhatsApp para enviar a resposta.", whatsappUrl: r.whatsappUrl };
    return { ok: true, message: r.sent ? "Resposta enviada." : "Guardada, mas o WhatsApp não respondeu: tente outra vez." };
  }, "Resposta enviada.");
}

export async function closeChatAction(conversationId: string) {
  await requireStaffAction("content");
  return run(() => closeConversation(conversationId), "Conversa fechada.");
}
