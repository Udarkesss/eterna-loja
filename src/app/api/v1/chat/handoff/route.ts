import { z } from "zod";
import { siteHandoff } from "@/server/assistant/chat";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

const body = z.object({ token: z.string().min(10).max(64), mode: z.enum(["here", "whatsapp"]), name: z.string().max(60).optional() });

/**
 * POST /api/v1/chat/handoff { token, mode: "here" | "whatsapp" }
 * EN: "Falar com uma pessoa": leave the message here or continue on WhatsApp. PT: Deixar mensagem aqui ou ir para o WhatsApp.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid body", 400);
  return jsonData(await siteHandoff(parsed.data.token, parsed.data.mode, parsed.data.name));
});
