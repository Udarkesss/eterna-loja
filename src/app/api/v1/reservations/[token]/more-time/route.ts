import { currentCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { requestMoreTime } from "@/server/reservations";

/**
 * POST /api/v1/reservations/:token/more-time
 * EN: "Pedir mais tempo" (account and confirmation); the team extends it in Gestão · Reservas.
 * PT: "Pedir mais tempo" (conta e confirmação); a equipa prolonga em Gestão · Reservas.
 */
export const POST = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const customer = await currentCustomer();
  return jsonData(await requestMoreTime((await params).token, customer?.id ?? null));
});
