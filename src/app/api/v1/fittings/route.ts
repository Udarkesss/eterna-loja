import { bridalBookingSchema } from "@/lib/auth-schemas";
import { currentCustomer } from "@/server/accounts";
import { createBridalBooking } from "@/server/bridal";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/fittings  { locale, productSlugs, packageKey, extras, date, time, name, email?, phone, weddingDate?, notes?,
 *                          method, msisdn?, acceptTerms }
 * EN: "Agendar prova de noiva" (design V3): holds the time and starts the payment of the package; the price comes from
 *     Gestão → Provas. 409 SLOT_TAKEN if the time was just taken. Then GET /api/v1/fittings/:token/payment.
 * PT: Reserva a hora e começa o pagamento do pacote; o valor vem de Gestão → Provas. 409 SLOT_TAKEN se a hora acabou
 *     de ser ocupada. Depois GET /api/v1/fittings/:token/payment.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const input = await parseJson(request, bridalBookingSchema);
  const customer = await currentCustomer();
  return jsonData(await createBridalBooking(input, customer?.id ?? null), 201);
});
