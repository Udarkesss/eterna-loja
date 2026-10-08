import { forgotSchema } from "@/lib/auth-schemas";
import { requestCustomerPasswordReset } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/auth/customer/forgot  { identifier }
 * EN: Sends a 6-digit code to the registered e-mail or WhatsApp. Always answers the same (no account leak).
 * PT: Envia um código de 6 dígitos para o e-mail ou WhatsApp registado. Responde sempre igual.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const { identifier } = await parseJson(request, forgotSchema);
  return jsonData(await requestCustomerPasswordReset(identifier));
});
