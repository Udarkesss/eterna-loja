import { resetSchema } from "@/lib/auth-schemas";
import { resetCustomerPassword } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/** POST /api/v1/auth/customer/reset  { identifier, code, password } — EN: new password + session. PT: nova palavra-passe. */
export const POST = withErrorHandling(async (request: Request) =>
  jsonData(await resetCustomerPassword(await parseJson(request, resetSchema))),
);
