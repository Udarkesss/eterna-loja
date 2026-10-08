import { cancelPendingPayment } from "@/server/checkout";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";

/**
 * POST /api/v1/orders/:id/cancel
 * EN: "Cancelar e mudar de método": frees the reserved pieces so the customer can pay another way.
 * PT: "Cancelar e mudar de método": liberta as peças reservadas para a cliente pagar de outra forma.
 */
export const POST = withErrorHandling(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const status = await cancelPendingPayment((await params).id);
    if (!status) throw new AppError("NOT_FOUND", "Order not found", 404);
    return jsonData(status);
  },
);
