import { createOrderSchema } from "@/lib/validation";
import { createOrder } from "@/server/checkout";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

/**
 * POST /api/v1/orders
 * EN: Creates an order, reserves stock and starts the payment. Body: CreateOrderInput (src/lib/validation.ts).
 * PT: Cria uma encomenda, reserva o stock e inicia o pagamento. Corpo: CreateOrderInput.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Invalid order", 400, parsed.error.flatten());
  return jsonData(await createOrder(parsed.data), 201);
});
