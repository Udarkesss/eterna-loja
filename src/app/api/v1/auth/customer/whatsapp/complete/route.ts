import { whatsappCompleteSchema } from "@/lib/auth-schemas";
import { completeWhatsappSignup } from "@/server/accounts";
import { jsonData, withErrorHandling } from "@/server/errors";
import { parseJson } from "@/server/request";

/**
 * POST /api/v1/auth/customer/whatsapp/complete  { phone, code, name, password, locale }
 * EN: Step 3. Links to the existing account when the number already has one. PT: Passo 3; liga à conta existente.
 */
export const POST = withErrorHandling(async (request: Request) =>
  jsonData(await completeWhatsappSignup(await parseJson(request, whatsappCompleteSchema)), 201),
);
