import { z } from "zod";
import { currentCustomer } from "@/server/accounts";
import { checkVoucher } from "@/server/discounts";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { customerLevel } from "@/server/loyalty";

const body = z.object({ code: z.string().trim().min(2).max(40), subtotal: z.number().int().min(0).max(1_000_000_000) });

/**
 * POST /api/v1/checkout/voucher { code, subtotal }
 * EN: "Tem um voucher? · Aplicar" — checks a code for the signed-in customer and this cart; the order checks it again.
 * PT: "Tem um voucher? · Aplicar" — verifica o código para a cliente com sessão e este carrinho; a encomenda volta a verificar.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid body", 400);
  const customer = await currentCustomer();
  const level = customer ? await customerLevel(customer.id) : null;
  const r = await checkVoucher(parsed.data.code, parsed.data.subtotal, customer && level ? { id: customer.id, level } : null);
  if (!r.ok) return jsonData({ ok: false as const, error: r.error, min: r.min ?? null });
  return jsonData({ ok: true as const, code: r.voucher.code, amount: r.amount, stacks: r.voucher.stacksWithLevel, kind: r.voucher.kind, value: r.voucher.value });
});
