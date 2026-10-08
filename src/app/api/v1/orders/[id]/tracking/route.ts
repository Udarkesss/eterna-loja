import { trackingFor } from "@/server/delivery";
import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { findOrder } from "@/server/orders";

/**
 * GET /api/v1/orders/:id/tracking
 * EN: Live delivery tracking: driver, vehicle, expected arrival and position (only while in transit).
 *     The order id is an unguessable UUID, the same one used in the tracking link.
 * PT: Acompanhamento ao vivo: entregador, veículo, hora prevista e posição (só em trânsito).
 */
export const GET = withErrorHandling(async (_: Request, { params }: { params: Promise<{ id: string }> }) => {
  const order = await findOrder((await params).id);
  if (!order || order.fulfillmentType !== "delivery") throw new AppError("NOT_FOUND", "Order not found", 404);
  return jsonData(await trackingFor(order));
});
