import { confirmReceipt, trackingFor } from "@/server/delivery";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { findOrder } from "@/server/orders";

/**
 * POST /api/v1/orders/:id/confirm-receipt
 * EN: "Confirmo que recebi" — only after the driver marked the order as delivered without the code.
 * PT: "Confirmo que recebi" — só depois de o entregador marcar a entrega sem código.
 */
export const POST = withErrorHandling(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  const order = await findOrder((await params).id);
  if (!order || order.fulfillmentType !== "delivery") throw new AppError("NOT_FOUND", "Order not found", 404);
  await confirmReceipt(order);
  return jsonData(await trackingFor((await findOrder(order.id))!));
});
