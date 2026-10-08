import { getOrderStatus } from "@/server/checkout";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

/**
 * GET /api/v1/orders/:id
 * EN: Payment status of an order. The id is a UUID, so it cannot be guessed.
 * PT: Estado do pagamento de uma encomenda. O id é um UUID, por isso não se consegue adivinhar.
 */
export const GET = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const status = await getOrderStatus(id);
    if (!status) throw new AppError("NOT_FOUND", "Order not found", 404);
    return jsonData(status);
  },
);
