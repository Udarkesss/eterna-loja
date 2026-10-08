import { getCheckoutOptions } from "@/server/content";
import { jsonData, withErrorHandling } from "@/server/errors";
import { localeFromRequest } from "@/server/request";

/**
 * GET /api/v1/checkout/options?locale=pt
 * EN: Payment methods switched on, pickup stores and delivery zones. PT: Métodos activos, lojas e zonas de entrega.
 */
export const GET = withErrorHandling(async (request: Request) => {
  return jsonData(await getCheckoutOptions(localeFromRequest(request)));
});
