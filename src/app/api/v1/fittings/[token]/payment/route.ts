import { bookingStatus } from "@/server/bridal";
import { jsonData, withErrorHandling } from "@/server/errors";

/**
 * GET /api/v1/fittings/:token/payment
 * EN: Payment state of a Bridal fitting ("pending" → "paid" / "failed"). PT: Estado do pagamento de uma prova.
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return jsonData(await bookingStatus(token));
});
