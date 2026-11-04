import { z } from "zod";
import { isLocale } from "@/i18n/config";
import { currentCustomer } from "@/server/accounts";
import { siteMessage, siteMessagesSince } from "@/server/assistant/chat";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

const body = z.object({ token: z.string().max(64).nullable().optional(), text: z.string().trim().min(1).max(500), locale: z.string().optional() });

/**
 * POST /api/v1/chat { token?, text, locale } → { token, messages, human, unsure }
 * EN: A message in the store chat (design V3-Chat). The first one returns the conversation token (kept in the browser).
 * PT: Uma mensagem no chat da loja. A primeira devolve o token da conversa (guardado no browser).
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid body", 400);
  const customer = await currentCustomer();
  const locale = isLocale(parsed.data.locale) ? parsed.data.locale : "pt";
  return jsonData(await siteMessage(parsed.data.token ?? null, parsed.data.text, locale, customer?.id ?? null));
});

/**
 * GET /api/v1/chat?token=…&since=ISO → { messages, human }
 * EN: New messages (the team's replies appear while the window is open). PT: Mensagens novas (respostas da equipa).
 */
export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token || token.length > 64) throw new AppError("VALIDATION_ERROR", "Missing token", 400);
  return jsonData(await siteMessagesSince(token, url.searchParams.get("since")));
});
