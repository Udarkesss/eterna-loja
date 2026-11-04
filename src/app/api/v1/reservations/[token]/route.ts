import { AppError, jsonData, withErrorHandling } from "@/server/errors";
import { reservationByToken } from "@/server/reservations";

/**
 * GET /api/v1/reservations/:token
 * EN: A reservation for its confirmation page (the token is the private link). PT: Uma reserva para a página de confirmação.
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const r = await reservationByToken((await params).token);
  if (!r) throw new AppError("NOT_FOUND", "Reservation not found", 404);
  return jsonData(r);
});
