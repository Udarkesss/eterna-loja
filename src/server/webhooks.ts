import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { applyPaymentResult } from "./checkout";
import { AppError, jsonData, withErrorHandling } from "./errors";
import type { GatewayMethod } from "./payments";

/**
 * EN: Shared webhook handler for the payment providers.
 *     TODO (phase 6): replace the shared-secret check and body format with each provider's real specification.
 * PT: Tratamento comum dos webhooks dos fornecedores de pagamento.
 *     TODO (fase 6): substituir a verificação por segredo e o formato pela especificação real de cada fornecedor.
 */

const webhookBodySchema = z.object({
  reference: z.string().min(1),
  status: z.enum(["paid", "failed"]),
  responseCode: z.string().max(20).optional(),
});

function isAuthorized(request: Request): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  const received = request.headers.get("x-webhook-secret");
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createWebhookHandler(method: GatewayMethod) {
  return withErrorHandling(async (request: Request) => {
    if (!isAuthorized(request)) throw new AppError("UNAUTHORIZED", "Invalid webhook secret", 401);
    const parsed = webhookBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid webhook body", 400);
    const applied = await applyPaymentResult(parsed.data.reference, parsed.data.status, parsed.data.responseCode);
    return jsonData({ received: true, method, applied });
  });
}
