import { loginSchema } from "@/lib/auth-schemas";
import { loginCustomer } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/auth/customer/login  { identifier, password }
 * EN: E-mail or WhatsApp number + password. PT: E-mail ou número de WhatsApp + palavra-passe.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { identifier, password } = await parseJson(request, loginSchema);
  return jsonData(await loginCustomer(identifier, password));
});
