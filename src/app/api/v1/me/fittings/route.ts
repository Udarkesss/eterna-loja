import { requireCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { listCustomerFittings } from "@/server/fittings";
import { localeFromRequest } from "@/server/request";

/** GET /api/v1/me/fittings?locale=pt — EN: "As minhas provas". PT: As minhas provas. */
export const GET = withErrorHandling(async (request: Request) =>
  jsonData(await listCustomerFittings((await requireCustomer()).id, localeFromRequest(request))),
);
